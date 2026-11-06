// Transport bridge (transport-snapshot spec, 2026-11-06): the one deep module
// at the shell seam between the Stem Player and everything the Tab Shell shows.
// Interface = one snapshot read side (`subscribe` + `getSnapshot`, read with
// useSyncExternalStore semantics — the reference is stable between changes so
// React readers never re-render on an equal snapshot) and exactly four
// commands: play · pause · seek · setMasterVolume. ADR-0013's cadence and
// ownership rules live HERE, in the live adapter's implementation: the
// Playhead rides the engine's position channel, levels ride the coalesced
// levels channel, the mixer bridge feeds master-volume restatements only, and
// the disc's dispatch stays a UI-side decision over a transport that acts.
// The Stem Player's interface — its bridge handoff and its five channels —
// is untouched; this module consumes it as-is.
import type { StereoPeakLevels } from "./stemPlayerEngine";
import type { TransportControls } from "../components/StemPlayer";

// Snapshot shape, prototype-derived and decision-bearing (spec, 2026-11-06).
// playheadSec is canonical Source Mix seconds, invariant under Time-Stretch
// (ADR-0013); masterVolume is the Master bus value, never a footer-local copy;
// levels are the engine's coalesced post-fader L/R sample.
export interface TransportSnapshot {
  playing: boolean;
  playheadSec: number;
  masterVolume: number;
  levels: StereoPeakLevels;
}

export interface TransportBridge {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TransportSnapshot;
  play: () => void;
  pause: () => void;
  seek: (seekSec: number) => void;
  setMasterVolume: (volume: number) => void;
}

// The unwired truth: with no player fed into the adapter, the snapshot reads
// idle and every command is an inert no-op (Separate Tab, pre-separation,
// post-purge — the footer chrome stays sane with no engine anywhere).
export const IDLE_TRANSPORT_SNAPSHOT: TransportSnapshot = {
  playing: false,
  playheadSec: 0,
  masterVolume: 1.0,
  levels: { left: 0, right: 0 },
};

// The live adapter's input side — the App's wiring points for the Stem
// Player's five channels plus the seeding rules. The shell reads only the
// `bridge`; nothing outside App writes these inputs.
export interface LiveTransportBridge {
  bridge: TransportBridge;
  // The bridge handoff moment (onTransportControls): commands start driving
  // the handed-off engine; before it, they are inert no-ops.
  handoff: (controls: TransportControls) => void;
  // The player is gone (unmount/purge): commands go inert again.
  release: () => void;
  // Play-state channel (onPlayStateChange): fires at the play/pause
  // transitions and on the position ticks mirroring engine.isPlaying, so
  // end-of-track stops flip the snapshot back, mirror-desync included.
  setPlaying: (playing: boolean) => void;
  // The one Playhead channel (onPlayheadChange, ADR-0013's position
  // subscription): Playhead and phase ride this and nothing else.
  setPlayheadSec: (timeSec: number) => void;
  // Levels channel (onLevelsChange): the engine's coalesced sample passes
  // through unmangled — the adapter never resamples it.
  setLevels: (levels: StereoPeakLevels) => void;
  // Mixer bridge restatement (onMixerChange): master volume only, never
  // per-frame; whoever fired the bridge, the restatement lands on readers.
  restateMasterVolume: (volume: number) => void;
  // Seeding (ADR-0013 amendment, transport-snapshot 2026-11-06): a restored
  // Session seeds its Master volume and Playhead before the player mounts,
  // so the footer never flashes defaults. Never a fourth mixer writer —
  // persistence keeps its single writer in the mixer bridge.
  seed: (seed: { masterVolume: number; playheadSec: number }) => void;
  // Fresh defaults (separation completion, purge): not playing, Playhead 0,
  // volume 1.0, silent levels.
  reset: () => void;
}

function snapshotEquals(a: TransportSnapshot, b: TransportSnapshot): boolean {
  return (
    a.playing === b.playing &&
    a.playheadSec === b.playheadSec &&
    a.masterVolume === b.masterVolume &&
    a.levels.left === b.levels.left &&
    a.levels.right === b.levels.right
  );
}

export function createLiveTransportBridge(
  initial: Partial<TransportSnapshot> = {}
): LiveTransportBridge {
  let snapshot: TransportSnapshot = { ...IDLE_TRANSPORT_SNAPSHOT, ...initial };
  let controls: TransportControls | null = null;
  const listeners = new Set<() => void>();

  // Reference stability: an equal snapshot never publishes and never mints a
  // new object, so useSyncExternalStore readers never re-render on no-change.
  const publish = (next: TransportSnapshot) => {
    if (snapshotEquals(snapshot, next)) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const bridge: TransportBridge = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    play: () => {
      controls?.play();
    },
    pause: () => {
      controls?.pause();
    },
    // The player's fifth verb, seekToStart, rides here as seek(0): the shell
    // uses the four verbs only (ADR-0013 amendment, transport-snapshot).
    seek: (seekSec) => {
      controls?.seek(seekSec);
    },
    setMasterVolume: (volume) => {
      controls?.setMasterVolume(volume);
    },
  };

  return {
    bridge,
    handoff: (handedControls) => {
      controls = handedControls;
    },
    release: () => {
      controls = null;
    },
    setPlaying: (playing) => {
      publish({ ...snapshot, playing });
    },
    setPlayheadSec: (timeSec) => {
      publish({ ...snapshot, playheadSec: timeSec });
    },
    setLevels: (levels) => {
      publish({ ...snapshot, levels: { ...levels } });
    },
    restateMasterVolume: (volume) => {
      publish({ ...snapshot, masterVolume: volume });
    },
    seed: ({ masterVolume, playheadSec }) => {
      publish({ ...snapshot, masterVolume, playheadSec });
    },
    reset: () => {
      publish({ ...IDLE_TRANSPORT_SNAPSHOT });
    },
  };
}
