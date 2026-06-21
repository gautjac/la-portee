import { describe, it, expect } from "vitest";
import { detectPitch } from "./pitch";
import { freqToMidi } from "./music";

function sine(freq: number, sampleRate: number, n: number, harmonics = false): Float32Array {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = Math.sin(2 * Math.PI * freq * t);
    if (harmonics) {
      v += 0.4 * Math.sin(2 * Math.PI * 2 * freq * t);
      v += 0.2 * Math.sin(2 * Math.PI * 3 * freq * t);
      v *= 0.6;
    }
    buf[i] = v * 0.8;
  }
  return buf;
}

describe("detectPitch", () => {
  const sr = 44100;

  it("detects a pure 440 Hz sine within 1 Hz", () => {
    const res = detectPitch(sine(440, sr, 4096), sr);
    expect(res).not.toBeNull();
    expect(res!.freq).toBeGreaterThan(439);
    expect(res!.freq).toBeLessThan(441);
  });

  it("detects a 220 Hz tone with harmonics (finds the fundamental)", () => {
    const res = detectPitch(sine(220, sr, 4096, true), sr);
    expect(res).not.toBeNull();
    expect(Math.abs(freqToMidi(res!.freq) - freqToMidi(220))).toBeLessThan(0.2);
  });

  it("detects a high 880 Hz tone", () => {
    const res = detectPitch(sine(880, sr, 4096), sr);
    expect(res).not.toBeNull();
    expect(res!.freq).toBeGreaterThan(875);
    expect(res!.freq).toBeLessThan(885);
  });

  it("returns null for silence", () => {
    expect(detectPitch(new Float32Array(4096), sr)).toBeNull();
  });

  it("reports high clarity for a clean tone", () => {
    const res = detectPitch(sine(330, sr, 4096), sr);
    expect(res!.clarity).toBeGreaterThan(0.9);
  });
});
