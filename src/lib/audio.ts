// ─────────────────────────────────────────────────────────────────────────
// La Portée — Web Audio engine.
// A warm sampled-piano-ish additive voice with ADSR, gentle low-pass and an
// algorithmic reverb so the reader HEARS what they read. Plays single notes,
// chords and tempo'd sequences. A separate "tick" voice marks the metronome
// for the rhythm + scrolling drills. Entirely client-side; works offline.
// ─────────────────────────────────────────────────────────────────────────

import { midiToFreq } from "./music";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbBus: GainNode | null = null;
let dryBus: GainNode | null = null;
let convolver: ConvolverNode | null = null;
let reverbEnabled = true;

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.85;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;

    dryBus = ctx.createGain();
    dryBus.gain.value = 0.84;
    reverbBus = ctx.createGain();
    reverbBus.gain.value = 0.24;

    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.0, 2.7);

    dryBus.connect(master);
    reverbBus.connect(convolver);
    convolver.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx!;
}

function makeImpulse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = context.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = context.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export async function unlockAudio(): Promise<void> {
  const c = ensureContext();
  if (c.state === "suspended") await c.resume();
}

export function setReverb(on: boolean): void {
  reverbEnabled = on;
  if (reverbBus) reverbBus.gain.value = on ? 0.24 : 0;
}
export function isReverbOn(): boolean {
  return reverbEnabled;
}
export function setMasterVolume(v: number): void {
  ensureContext();
  if (master) master.gain.value = Math.max(0, Math.min(1, v));
}

const activeVoices = new Set<{ stop: () => void }>();
export function stopAll(): void {
  for (const v of [...activeVoices]) v.stop();
  activeVoices.clear();
}

interface VoiceOptions {
  at: number;
  duration: number;
  velocity?: number;
}

/** A warm piano-ish additive voice (struck partials, quick decay). */
function playVoice(freq: number, o: VoiceOptions): void {
  const c = ensureContext();
  const vel = o.velocity ?? 0.9;
  const t0 = o.at;
  const dur = o.duration;

  const voiceGain = c.createGain();
  voiceGain.gain.value = 0;

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(8400, freq * 7 + 1400);
  lp.Q.value = 0.5;

  voiceGain.connect(lp);
  if (dryBus) lp.connect(dryBus);
  if (reverbBus) lp.connect(reverbBus);

  const partials: Array<{ mult: number; gain: number; type: OscillatorType; detune: number }> = [
    { mult: 1, gain: 1.0, type: "triangle", detune: 0 },
    { mult: 2, gain: 0.5, type: "sine", detune: 1.2 },
    { mult: 3, gain: 0.26, type: "sine", detune: -1.5 },
    { mult: 4, gain: 0.14, type: "sine", detune: 2 },
    { mult: 6, gain: 0.07, type: "sine", detune: -2.5 },
  ];

  const oscs: OscillatorNode[] = [];
  for (const p of partials) {
    const osc = c.createOscillator();
    osc.type = p.type;
    osc.frequency.value = freq * p.mult;
    osc.detune.value = p.detune;
    const pg = c.createGain();
    pg.gain.value = p.gain;
    osc.connect(pg);
    pg.connect(voiceGain);
    oscs.push(osc);
  }

  const peak = 0.34 * vel;
  const sustain = peak * 0.42; // piano-ish: quick decay to a low sustain
  const attack = 0.006;
  const decay = 0.18;
  const release = 0.5;

  const g = voiceGain.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0, t0);
  g.linearRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(Math.max(0.0008, sustain), t0 + attack + decay);
  g.setValueAtTime(Math.max(0.0008, sustain), t0 + Math.max(attack + decay, dur));
  g.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + decay, dur) + release);

  const endTime = t0 + Math.max(attack + decay, dur) + release + 0.05;
  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(endTime);
  }

  const voice = {
    stop: () => {
      const now = c.currentTime;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(Math.max(0.0001, g.value), now);
        g.exponentialRampToValueAtTime(0.0001, now + 0.08);
        for (const osc of oscs) osc.stop(now + 0.1);
      } catch {
        /* already stopped */
      }
      activeVoices.delete(voice);
    },
  };
  activeVoices.add(voice);
  setTimeout(() => activeVoices.delete(voice), (endTime - c.currentTime) * 1000 + 50);
}

export function playNote(midi: number, duration = 1.0, offset = 0, velocity = 0.9): void {
  const c = ensureContext();
  playVoice(midiToFreq(midi), { at: c.currentTime + offset, duration, velocity });
}

export function playChord(notes: number[], rolled = false, noteDur = 1.5): void {
  const c = ensureContext();
  const t = c.currentTime + 0.02;
  notes.forEach((m, i) => {
    const offset = rolled ? i * 0.1 : 0;
    playVoice(midiToFreq(m), { at: t + offset, duration: noteDur - offset });
  });
}

/** Play MIDI notes spaced by their beat lengths at a tempo. */
export function playSequence(
  steps: { midi: number; beats: number }[],
  bpm = 92,
  startOffset = 0.06,
): void {
  const c = ensureContext();
  const beat = 60 / bpm;
  let t = c.currentTime + startOffset;
  for (const s of steps) {
    const dur = s.beats * beat;
    playVoice(midiToFreq(s.midi), { at: t, duration: dur * 0.92 });
    t += dur;
  }
}

/** A short woodblock-ish metronome tick. */
export function playTick(at?: number, accent = false): void {
  const c = ensureContext();
  const t0 = at ?? c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = accent ? 1500 : 1050;
  const g = c.createGain();
  g.gain.value = 0;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = accent ? 1500 : 1050;
  bp.Q.value = 1.5;
  osc.connect(bp);
  bp.connect(g);
  if (master) g.connect(master);
  const peak = accent ? 0.3 : 0.18;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

export function now(): number {
  return ensureContext().currentTime;
}

export function getContext(): AudioContext {
  return ensureContext();
}
