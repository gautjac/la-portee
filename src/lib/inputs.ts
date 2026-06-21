// ─────────────────────────────────────────────────────────────────────────
// La Portée — alternative note inputs: microphone pitch detection (reusing
// the YIN/autocorrelation engine) and Web MIDI. Both are optional and degrade
// gracefully; the on-screen piano always works. Each exposes a tiny lifecycle:
// start() → emits detected MIDI notes; stop() tears down.
// ─────────────────────────────────────────────────────────────────────────

import { detectPitch } from "./pitch";
import { freqToNearestMidi } from "./music";

// ── Microphone pitch input ────────────────────────────────────────────────────

export type MicState = "idle" | "requesting" | "listening" | "denied" | "unsupported";

export interface MicHandle {
  stop: () => void;
}

/**
 * Start mic capture. Calls `onPitch(midi, clarity)` with the octave-FOLDED
 * detected note (pitch class only matters for reading-by-name), debounced so a
 * sustained sung note fires once. Returns a handle to stop.
 */
export async function startMic(
  onPitch: (midi: number, clarity: number) => void,
  onState: (s: MicState) => void,
): Promise<MicHandle | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    onState("unsupported");
    return null;
  }
  onState("requesting");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    onState("denied");
    return null;
  }

  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  onState("listening");

  let raf = 0;
  let lastFired = -1;
  let stableMidi = -1;
  let stableCount = 0;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const res = detectPitch(buf, ctx.sampleRate);
    if (res && res.clarity > 0.9) {
      const midi = freqToNearestMidi(res.freq);
      if (midi === stableMidi) {
        stableCount += 1;
      } else {
        stableMidi = midi;
        stableCount = 1;
      }
      // ~4 stable frames ≈ note has settled; fire once until it changes.
      if (stableCount >= 4 && midi !== lastFired) {
        lastFired = midi;
        onPitch(midi, res.clarity);
      }
    } else {
      stableCount = 0;
      stableMidi = -1;
      lastFired = -1; // allow the same note to re-fire after a gap
    }
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      if (ctx.state !== "closed") void ctx.close();
    },
  };
}

// ── Web MIDI input ────────────────────────────────────────────────────────────

export type MidiState = "idle" | "unsupported" | "connected" | "none";

export interface MidiHandle {
  stop: () => void;
}

interface MidiLike {
  inputs: { values: () => Iterable<MidiInputLike> };
}
interface MidiInputLike {
  name?: string;
  onmidimessage: ((e: { data: Uint8Array }) => void) | null;
}

/** Subscribe to Web MIDI note-on messages. Chromium-only; graceful elsewhere. */
export async function startMidi(
  onNote: (midi: number, velocity: number) => void,
  onState: (s: MidiState, deviceName?: string) => void,
): Promise<MidiHandle | null> {
  const nav = navigator as unknown as {
    requestMIDIAccess?: () => Promise<MidiLike>;
  };
  if (!nav.requestMIDIAccess) {
    onState("unsupported");
    return null;
  }
  let access: MidiLike;
  try {
    access = await nav.requestMIDIAccess();
  } catch {
    onState("unsupported");
    return null;
  }

  const inputs = [...access.inputs.values()];
  if (inputs.length === 0) {
    onState("none");
    return null;
  }
  let device = "";
  for (const input of inputs) {
    device = input.name ?? "MIDI";
    input.onmidimessage = (e: { data: Uint8Array }) => {
      const [status, note, vel] = e.data;
      // note-on (0x90) with non-zero velocity
      if ((status & 0xf0) === 0x90 && vel > 0) {
        onNote(note, vel / 127);
      }
    };
  }
  onState("connected", device);

  return {
    stop: () => {
      for (const input of inputs) input.onmidimessage = null;
    },
  };
}
