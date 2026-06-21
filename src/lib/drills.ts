// ─────────────────────────────────────────────────────────────────────────
// La Portée — drill question generators.
// Turns a level (clefs, range, keys) + an SRS-chosen item into a concrete,
// renderable, scorable question: which note on which clef in which key; a
// key-signature multiple choice; a rhythm to clap; a scrolling phrase to play.
// Scoring lives here too (note-name match, rhythm timing accuracy).
// ─────────────────────────────────────────────────────────────────────────

import {
  CLEFS,
  KEY_BY_ID,
  KEY_SIGNATURES,
  type Clef,
  type ClefId,
  type KeySignature,
  type DurationId,
  type Letter,
  LETTERS,
  LETTER_SOLFEGE,
  spellInKey,
  randInt,
  pick,
  shuffle,
  keyPitchClasses,
  DURATIONS,
} from "./music";
import type { Level } from "./curriculum";

export type NoteNameMode = "letters" | "solfege";

/** Letter → display label in the chosen naming mode. */
export function letterLabel(letter: Letter, mode: NoteNameMode): string {
  return mode === "solfege" ? LETTER_SOLFEGE[letter] : letter;
}

// ── Note-naming drill ────────────────────────────────────────────────────────

export interface NoteQuestion {
  clef: Clef;
  key: KeySignature;
  midi: number;
  /** The diatonic letter that is the correct answer. */
  answer: Letter;
  /** SRS item id, e.g. "treble:G4". */
  itemId: string;
}

/** Stable item id for a note in a clef (octave-specific, so the staff position is exact). */
export function noteItemId(clef: ClefId, midi: number): string {
  return `${clef}:${midi}`;
}

/** Generate a note-naming question scoped to a level, optionally forcing a clef/key. */
export function makeNoteQuestion(
  level: Level,
  rng: () => number = Math.random,
  forceClef?: ClefId,
  forceKey?: string,
): NoteQuestion {
  const clefId = forceClef ?? level.clefs[Math.floor(rng() * level.clefs.length)];
  const clef = CLEFS[clefId];
  const keyId = forceKey ?? level.keys[Math.floor(rng() * level.keys.length)];
  const key = KEY_BY_ID[keyId];

  // Draw a MIDI in range that belongs to the key's diatonic scale (clean reading).
  const pcs = new Set(keyPitchClasses(key));
  const candidates: number[] = [];
  for (let m = level.low; m <= level.high; m++) {
    if (pcs.has(((m % 12) + 12) % 12)) candidates.push(m);
  }
  const midi = candidates.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : level.low + Math.floor(rng() * (level.high - level.low + 1));

  const spelling = spellInKey(midi, key);
  return {
    clef,
    key,
    midi,
    answer: spelling.letter,
    itemId: noteItemId(clefId, midi),
  };
}

/** The seven letter options for the on-screen answer pad. */
export function letterOptions(): Letter[] {
  return [...LETTERS];
}

// ── Key-signature drill ──────────────────────────────────────────────────────

export interface KeyQuestion {
  key: KeySignature;
  clef: Clef;
  /** Four option key ids (one correct). */
  options: string[];
  itemId: string;
}

export function makeKeyQuestion(level: Level, rng: () => number = Math.random): KeyQuestion {
  const inScope = KEY_SIGNATURES.filter((k) => level.keys.includes(k.id));
  const pool = inScope.length >= 4 ? inScope : KEY_SIGNATURES;
  const key = pool[Math.floor(rng() * pool.length)];
  const clef = CLEFS[level.clefs[0]];

  const distractors = shuffle(KEY_SIGNATURES.filter((k) => k.id !== key.id))
    .slice(0, 3)
    .map((k) => k.id);
  const options = shuffle([key.id, ...distractors]);
  return { key, clef, options, itemId: key.id };
}

// ── Rhythm-clap drill ────────────────────────────────────────────────────────

export interface RhythmEvent {
  /** Beat index at which the onset falls (quarter = 1 beat). */
  beat: number;
  duration: DurationId;
}

export interface RhythmQuestion {
  events: RhythmEvent[];
  /** Total beats (bars × beatsPerBar). */
  totalBeats: number;
  bpm: number;
  beatsPerBar: number;
  itemId: string;
}

/** A pool of rhythmic cells (within one beat or two), keyed by difficulty. */
const RHYTHM_CELLS: Record<number, DurationId[][]> = {
  1: [["q"], ["8", "8"]],
  2: [["q"], ["8", "8"], ["h"], ["8", "8"]],
  3: [["q"], ["8", "8"], ["q"], ["16", "16", "8"], ["8", "16", "16"]],
};

export function makeRhythmQuestion(
  level: Level,
  rng: () => number = Math.random,
  bars = 2,
  beatsPerBar = 4,
): RhythmQuestion {
  const difficulty = level.id <= 2 ? 1 : level.id <= 5 ? 2 : 3;
  const cells = RHYTHM_CELLS[difficulty];
  const events: RhythmEvent[] = [];
  const totalBeats = bars * beatsPerBar;
  let beat = 0;
  while (beat < totalBeats - 0.001) {
    const cell = cells[Math.floor(rng() * cells.length)];
    const cellBeats = cell.reduce((s, d) => s + DURATIONS[d].beats, 0);
    if (beat + cellBeats > totalBeats + 0.001) {
      events.push({ beat, duration: "q" });
      beat += 1;
      continue;
    }
    let b = beat;
    for (const d of cell) {
      events.push({ beat: b, duration: d });
      b += DURATIONS[d].beats;
    }
    beat += cellBeats;
  }
  const bpm = difficulty === 1 ? 72 : difficulty === 2 ? 84 : 92;
  const itemId = events.map((e) => e.duration).join("-");
  return { events, totalBeats, bpm, beatsPerBar, itemId };
}

/**
 * Score a tapped rhythm against the target onsets. Returns per-onset hits and
 * an overall 0..1 accuracy. A tap counts if it falls within `windowMs` of an
 * un-claimed target onset; we greedily match the nearest.
 */
export interface RhythmScore {
  hits: number;
  total: number;
  /** Mean absolute timing error in ms over matched onsets. */
  meanErrorMs: number;
  accuracy: number; // 0..1
}

export function scoreRhythm(
  targetBeats: number[],
  tapTimesMs: number[],
  startMs: number,
  bpm: number,
  windowMs = 180,
): RhythmScore {
  const beatMs = 60000 / bpm;
  const targets = targetBeats.map((b) => startMs + b * beatMs);
  const claimed = new Array(targets.length).fill(false);
  let hits = 0;
  let errSum = 0;
  for (const tap of tapTimesMs) {
    let bestIdx = -1;
    let bestErr = Infinity;
    for (let i = 0; i < targets.length; i++) {
      if (claimed[i]) continue;
      const err = Math.abs(tap - targets[i]);
      if (err < bestErr) {
        bestErr = err;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestErr <= windowMs) {
      claimed[bestIdx] = true;
      hits += 1;
      errSum += bestErr;
    }
  }
  const total = targets.length;
  const meanErrorMs = hits > 0 ? errSum / hits : windowMs;
  // Accuracy blends coverage (did they hit the onsets) with timing tightness.
  const coverage = total > 0 ? hits / total : 0;
  const tightness = hits > 0 ? Math.max(0, 1 - meanErrorMs / windowMs) : 0;
  const accuracy = coverage * 0.7 + tightness * 0.3 * coverage;
  return { hits, total, meanErrorMs, accuracy };
}

// ── Scrolling sight-reading drill ────────────────────────────────────────────

export interface SightNote {
  midi: number;
  beat: number; // onset beat
  duration: DurationId;
}

export interface SightPhrase {
  clef: Clef;
  key: KeySignature;
  notes: SightNote[];
  totalBeats: number;
  bpm: number;
  beatsPerBar: number;
  itemId: string;
}

/** A short, singable, stepwise-ish phrase in the key, on one clef. */
export function makeSightPhrase(
  level: Level,
  rng: () => number = Math.random,
  bars = 2,
  beatsPerBar = 4,
): SightPhrase {
  const clefId = level.clefs[Math.floor(rng() * level.clefs.length)];
  const clef = CLEFS[clefId];
  const keyId = level.keys[Math.floor(rng() * level.keys.length)];
  const key = KEY_BY_ID[keyId];

  // Build the diatonic ladder of MIDIs in range.
  const pcs = new Set(keyPitchClasses(key));
  const ladder: number[] = [];
  for (let m = Math.max(level.low, clef.rangeLow - 2); m <= Math.min(level.high, clef.rangeHigh + 2); m++) {
    if (pcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }
  if (ladder.length === 0) ladder.push(clef.centerMidi);

  // Start near the tonic, move mostly stepwise.
  let idx = Math.floor(ladder.length / 2);
  const durChoices: DurationId[] = level.id <= 2 ? ["q", "q", "h"] : ["q", "8", "q", "h", "8"];
  const totalBeats = bars * beatsPerBar;
  const notes: SightNote[] = [];
  let beat = 0;
  while (beat < totalBeats - 0.001) {
    let dur = durChoices[Math.floor(rng() * durChoices.length)];
    const remaining = totalBeats - beat;
    if (DURATIONS[dur].beats > remaining) dur = "q";
    if (DURATIONS[dur].beats > remaining) dur = "8";
    notes.push({ midi: ladder[idx], beat, duration: dur });
    beat += DURATIONS[dur].beats;
    // wander stepwise, occasional small leap
    const step = rng() < 0.78 ? (rng() < 0.5 ? 1 : -1) : (rng() < 0.5 ? 2 : -2);
    idx = Math.max(0, Math.min(ladder.length - 1, idx + step));
  }
  const bpm = level.id <= 2 ? 60 : level.id <= 5 ? 66 : 76;
  const itemId = `${clefId}:${keyId}`;
  return { clef, key, notes, totalBeats, bpm, beatsPerBar, itemId };
}

export { pick, randInt, shuffle };
