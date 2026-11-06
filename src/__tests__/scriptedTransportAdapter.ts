// Scripted Transport adapter (transport-snapshot spec, 2026-11-06): the
// test-side double at the shell seam. It satisfies the same TransportBridge
// interface as the live adapter — it records the four commands and pushes
// scripted snapshots — so the whole transport surface (disc, fader, pips,
// spine wiring, clock chip) can be driven with NO audio machinery at all.
// It lives in the tests' mock home per the mock-separation rule (CODING_STANDARDS
// §4), and it is the second adapter that makes the seam real, not hypothetical.
import {
  TransportBridge,
  TransportSnapshot,
  IDLE_TRANSPORT_SNAPSHOT,
} from "../lib/transportBridge";

export type TransportCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; seekSec: number }
  | { type: "setMasterVolume"; volume: number };

export interface ScriptedTransport {
  bridge: TransportBridge;
  // Every command the shell crossed, in order.
  commands: TransportCommand[];
  // Push a scripted snapshot fact (the scripted twin of a live channel feed).
  push: (overlay: Partial<TransportSnapshot>) => void;
}

export function createScriptedTransport(
  initial: Partial<TransportSnapshot> = {}
): ScriptedTransport {
  let snapshot: TransportSnapshot = { ...IDLE_TRANSPORT_SNAPSHOT, ...initial };
  const commands: TransportCommand[] = [];
  const listeners = new Set<() => void>();

  const push = (overlay: Partial<TransportSnapshot>) => {
    const next = { ...snapshot, ...overlay };
    if (
      next.playing === snapshot.playing &&
      next.playheadSec === snapshot.playheadSec &&
      next.masterVolume === snapshot.masterVolume &&
      next.levels.left === snapshot.levels.left &&
      next.levels.right === snapshot.levels.right
    ) {
      return;
    }
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
      commands.push({ type: "play" });
    },
    pause: () => {
      commands.push({ type: "pause" });
    },
    seek: (seekSec) => {
      commands.push({ type: "seek", seekSec });
    },
    setMasterVolume: (volume) => {
      commands.push({ type: "setMasterVolume", volume });
    },
  };

  return { bridge, commands, push };
}
