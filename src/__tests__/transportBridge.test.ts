// Transport bridge behavior suite (transport-snapshot ticket 01): external
// behavior only — commands crossed in, snapshots observed out, through the
// scripted adapter and the live adapter's input side. Never component
// internals, never engine nodes.
import { describe, it, expect } from "vitest";
import {
  createLiveTransportBridge,
  IDLE_TRANSPORT_SNAPSHOT,
  TransportSnapshot,
} from "../lib/transportBridge";
import type { StereoPeakLevels } from "../lib/stemPlayerEngine";
import type { TransportControls } from "../components/StemPlayer";
import {
  createScriptedTransport,
  TransportCommand,
} from "./scriptedTransportAdapter";

const controlsSpy = (): { controls: TransportControls; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    controls: {
      play: () => calls.push("play"),
      pause: () => calls.push("pause"),
      seekToStart: () => calls.push("seekToStart"),
      seek: (seekTime: number) => calls.push(`seek(${seekTime})`),
      setMasterVolume: (volume: number) =>
        calls.push(`setMasterVolume(${volume})`),
    },
  };
};

describe("Transport bridge — scripted adapter (the seam)", () => {
  it("records the four verbs as the only transport commands the shell crosses", () => {
    const scripted = createScriptedTransport();
    scripted.bridge.play();
    scripted.bridge.pause();
    scripted.bridge.seek(12.5);
    scripted.bridge.setMasterVolume(0.4);
    const expected: TransportCommand[] = [
      { type: "play" },
      { type: "pause" },
      { type: "seek", seekSec: 12.5 },
      { type: "setMasterVolume", volume: 0.4 },
    ];
    expect(scripted.commands).toEqual(expected);
  });

  it("play flips playing; a scripted end-of-track stop flips playing back", () => {
    const scripted = createScriptedTransport();
    const seen: TransportSnapshot[] = [];
    scripted.bridge.subscribe(() => seen.push(scripted.bridge.getSnapshot()));

    scripted.bridge.play();
    scripted.push({ playing: true });
    expect(scripted.bridge.getSnapshot().playing).toBe(true);

    // End-of-track stop, scripted: the snapshot flips back on its own feed.
    scripted.push({ playing: false, playheadSec: 180 });
    expect(scripted.bridge.getSnapshot().playing).toBe(false);
    expect(seen.length).toBe(2);
  });

  it("seek lands playheadSec; setMasterVolume lands masterVolume", () => {
    const scripted = createScriptedTransport();
    scripted.bridge.seek(42);
    scripted.push({ playheadSec: 42 });
    expect(scripted.bridge.getSnapshot().playheadSec).toBe(42);

    scripted.bridge.setMasterVolume(0.7);
    scripted.push({ masterVolume: 0.7 });
    expect(scripted.bridge.getSnapshot().masterVolume).toBe(0.7);
  });

  it("a scripted level sample flows through coalesced, unmangled", () => {
    const scripted = createScriptedTransport();
    const expectedLevels: StereoPeakLevels = { left: 0.5, right: 0.15 };
    scripted.push({ levels: expectedLevels });
    expect(scripted.bridge.getSnapshot().levels).toEqual(expectedLevels);
  });

  it("holds one snapshot reference between changes — equal snapshots never re-publish", () => {
    const scripted = createScriptedTransport();
    const first = scripted.bridge.getSnapshot();
    expect(scripted.bridge.getSnapshot()).toBe(first);

    scripted.push({ playing: true });
    const second = scripted.bridge.getSnapshot();
    expect(second).not.toBe(first);

    // An equal push mints nothing and notifies nobody.
    let notices = 0;
    scripted.bridge.subscribe(() => {
      notices++;
    });
    scripted.push({ playing: true });
    expect(scripted.bridge.getSnapshot()).toBe(second);
    expect(notices).toBe(0);
  });
});

describe("Transport bridge — live adapter (the shell's own wiring)", () => {
  it("an unwired snapshot reads idle and every command is an inert no-op", () => {
    const live = createLiveTransportBridge();
    expect(live.bridge.getSnapshot()).toEqual(IDLE_TRANSPORT_SNAPSHOT);
    expect(() => {
      live.bridge.play();
      live.bridge.pause();
      live.bridge.seek(9);
      live.bridge.setMasterVolume(0.3);
    }).not.toThrow();
    expect(live.bridge.getSnapshot()).toEqual(IDLE_TRANSPORT_SNAPSHOT);
  });

  it("after the handoff, the four verbs drive the handed-off controls", () => {
    const live = createLiveTransportBridge();
    const spy = controlsSpy();
    live.handoff(spy.controls);

    live.bridge.play();
    live.bridge.pause();
    live.bridge.seek(3.5);
    live.bridge.setMasterVolume(0.9);
    expect(spy.calls).toEqual([
      "play",
      "pause",
      "seek(3.5)",
      "setMasterVolume(0.9)",
    ]);

    // Release (the player is gone): commands go inert again.
    live.release();
    live.bridge.play();
    expect(spy.calls).toEqual([
      "play",
      "pause",
      "seek(3.5)",
      "setMasterVolume(0.9)",
    ]);
  });

  it("the channel feeds land the snapshot fields the shell reads", () => {
    const live = createLiveTransportBridge();
    const expected: TransportSnapshot = {
      playing: true,
      playheadSec: 7.25,
      masterVolume: 0.85,
      levels: { left: 0.6, right: 0.2 },
    };
    live.setPlaying(true);
    live.setPlayheadSec(7.25);
    live.setLevels({ left: 0.6, right: 0.2 });
    live.restateMasterVolume(0.85);
    expect(live.bridge.getSnapshot()).toEqual(expected);
  });

  it("a stable snapshot reference: equal feeds never mint a new snapshot", () => {
    const live = createLiveTransportBridge();
    const first = live.bridge.getSnapshot();
    live.setPlaying(false); // already idle-false
    live.setPlayheadSec(0); // already 0
    expect(live.bridge.getSnapshot()).toBe(first);

    live.setPlaying(true);
    const second = live.bridge.getSnapshot();
    expect(second).not.toBe(first);
    live.setPlaying(true);
    expect(live.bridge.getSnapshot()).toBe(second);
  });

  it("the play-state channel flips playing back — the end-of-track stop path", () => {
    const live = createLiveTransportBridge();
    live.setPlaying(true);
    expect(live.bridge.getSnapshot().playing).toBe(true);
    live.setPlaying(false);
    expect(live.bridge.getSnapshot().playing).toBe(false);
  });

  it("seeding lands the restored Session's values; reset returns fresh defaults", () => {
    const live = createLiveTransportBridge();
    const seeded: TransportSnapshot = {
      playing: false,
      playheadSec: 42,
      masterVolume: 0.9,
      levels: { left: 0, right: 0 },
    };
    live.seed({ masterVolume: 0.9, playheadSec: 42 });
    expect(live.bridge.getSnapshot()).toEqual(seeded);

    // Live traffic on top of the seed, then the wipe: fresh defaults.
    live.setPlaying(true);
    live.setLevels({ left: 0.4, right: 0.4 });
    live.setPlayheadSec(99);
    live.reset();
    expect(live.bridge.getSnapshot()).toEqual(IDLE_TRANSPORT_SNAPSHOT);
  });
});
