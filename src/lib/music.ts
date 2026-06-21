// ─────────────────────────────────────────────────────────────────────────
// La Portée — the music engine.
// Pure, dependency-free, unit-tested: MIDI ↔ note name, diatonic staff-step
// mapping (the position a note sits on a clef), clefs, key signatures and
// their accidentals, rhythm durations. This is what turns "MIDI 60 in treble
// clef" into "first ledger line below the staff", which the renderer draws.
// ─────────────────────────────────────────────────────────────────────────

export const A4_MIDI = 69;
export const A4_FREQ = 440;

/** Sharp spelling, indexed by pitch class (0 = C). */
export const NOTE_NAMES_SHARP = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Flat spelling, by pitch class. */
export const NOTE_NAMES_FLAT = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const;

/** Solfège syllables (do, ré, mi…) by pitch class (natural-anchored). */
export const SOLFEGE_SHARP = [
  "do", "do♯", "ré", "ré♯", "mi", "fa", "fa♯", "sol", "sol♯", "la", "la♯", "si",
] as const;

export const SOLFEGE_FLAT = [
  "do", "ré♭", "ré", "mi♭", "mi", "fa", "sol♭", "sol", "la♭", "la", "si♭", "si",
] as const;

/** The seven diatonic letters in order, C-based. */
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];

/** Solfège syllable for each diatonic letter. */
export const LETTER_SOLFEGE: Record<Letter, string> = {
  C: "do", D: "ré", E: "mi", F: "fa", G: "sol", A: "la", B: "si",
};

/** Semitone offset of each natural letter from C. */
const LETTER_SEMITONE: Record<Letter, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// ── freq ↔ MIDI ────────────────────────────────────────────────────────────

export function midiToFreq(midi: number, a4 = A4_FREQ): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}
export function freqToMidi(freq: number, a4 = A4_FREQ): number {
  return A4_MIDI + 12 * Math.log2(freq / a4);
}
export function freqToNearestMidi(freq: number, a4 = A4_FREQ): number {
  return Math.round(freqToMidi(freq, a4));
}
export function centsBetween(f1: number, f2: number): number {
  return 1200 * Math.log2(f2 / f1);
}

// ── Note names ──────────────────────────────────────────────────────────────

export interface NoteName {
  name: string; // "C#"
  flat: string; // "Db"
  solfege: string; // "do♯"
  octave: number; // SPN, C4 = middle C = MIDI 60
  pc: number; // 0..11
}

export function midiToNote(midi: number): NoteName {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    name: NOTE_NAMES_SHARP[pc],
    flat: NOTE_NAMES_FLAT[pc],
    solfege: SOLFEGE_SHARP[pc],
    octave,
    pc,
  };
}

/** Pretty label, "C#4" / "Db4" / "do♯4". */
export function noteLabel(
  midi: number,
  mode: "name" | "flat" | "solfege" = "name",
): string {
  const n = midiToNote(midi);
  const head = mode === "flat" ? n.flat : mode === "solfege" ? n.solfege : n.name;
  return `${head}${n.octave}`;
}

/** Parse SPN like "A4", "C#3", "Bb5", "F#-1" → MIDI. */
export function noteToMidi(spn: string): number {
  const m = /^([A-Ga-g])([#b♯♭]*)(-?\d+)$/.exec(spn.trim());
  if (!m) throw new Error(`Nom de note invalide : ${spn}`);
  const letter = m[1].toUpperCase() as Letter;
  let pc = LETTER_SEMITONE[letter];
  for (const ch of m[2]) {
    if (ch === "#" || ch === "♯") pc += 1;
    if (ch === "b" || ch === "♭") pc -= 1;
  }
  return (parseInt(m[3], 10) + 1) * 12 + pc;
}

// ── Diatonic step (the heart of staff placement) ────────────────────────────
// A "diatonic step" counts only the seven letters, so consecutive lines/spaces
// on the staff differ by exactly one step. C0 = step 0; C4 (middle C) = step 28.
// Two adjacent positions on a staff (a line then the space above it) are one
// step apart. This is what makes a note sit on the correct line/space.

export interface PitchSpelling {
  /** Diatonic letter: C D E F G A B. */
  letter: Letter;
  /** Accidental relative to the natural letter: -2..+2 (semitones). */
  accidental: number;
  /** Octave (SPN). */
  octave: number;
}

/** Diatonic step number for a letter+octave (C of octave 0 = 0). */
export function diatonicStep(letter: Letter, octave: number): number {
  return octave * 7 + LETTERS.indexOf(letter);
}

/** The MIDI of a spelled pitch. */
export function spellingToMidi(s: PitchSpelling): number {
  return (s.octave + 1) * 12 + LETTER_SEMITONE[s.letter] + s.accidental;
}

/**
 * Spell a MIDI note for a given key signature: which letter + accidental it is.
 * Naturals in the key keep no printed accidental; chromatic notes take the
 * accidental implied by the key's spelling (sharp keys → sharps, flat keys →
 * flats). This is what decides whether MIDI 61 reads as "C#" or "Db".
 */
export function spellInKey(midi: number, key: KeySignature): PitchSpelling {
  const pc = ((midi % 12) + 12) % 12;
  // Members of the key's diatonic scale: map each scale pc → its letter.
  const scalePc = keyScalePitchClasses(key);
  const member = scalePc.find((m) => m.pc === pc);
  if (member) {
    const octave = octaveForLetterPc(midi, member.semitoneFromC);
    return { letter: member.letter, accidental: member.accidental, octave };
  }
  // Chromatic (non-diatonic) note: spell with the key's accidental flavour.
  const useFlats = key.accidentalType === "flat";
  const spelling = useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
  const letter = spelling[0] as Letter;
  const accidental = spelling.includes("#") ? 1 : spelling.includes("b") ? -1 : 0;
  const octave = octaveForLetterPc(midi, LETTER_SEMITONE[letter]);
  return { letter, accidental, octave };
}

/** Find the octave so that the spelled letter lands on the right MIDI. */
function octaveForLetterPc(midi: number, semitoneFromC: number): number {
  // midi = (octave+1)*12 + semitoneFromC  → solve, handle enharmonic wrap (Cb/B#).
  const octave = Math.floor(midi / 12) - 1;
  for (const cand of [octave, octave - 1, octave + 1]) {
    if ((cand + 1) * 12 + semitoneFromC === midi) return cand;
  }
  return octave;
}

// ── Clefs ──────────────────────────────────────────────────────────────────

export type ClefId = "treble" | "bass" | "alto";

export interface Clef {
  id: ClefId;
  fr: string;
  en: string;
  /** The diatonic step that sits on the BOTTOM staff line. */
  bottomLineStep: number;
  /** MIDI of a comfortable centre note for generating drills. */
  centerMidi: number;
  /** Comfortable low/high MIDI for note-naming drills. */
  rangeLow: number;
  rangeHigh: number;
}

// Bottom line of treble is E4 (step = diatonicStep('E',4) = 4*7+2 = 30).
// Bottom line of bass is G2 (step = 2*7+4 = 18).
// Bottom line of alto is F3 (step = 3*7+3 = 24).
export const CLEFS: Record<ClefId, Clef> = {
  treble: {
    id: "treble",
    fr: "Clé de sol",
    en: "Treble clef",
    bottomLineStep: diatonicStep("E", 4),
    centerMidi: 71, // B4, middle line
    rangeLow: 60,
    rangeHigh: 81,
  },
  bass: {
    id: "bass",
    fr: "Clé de fa",
    en: "Bass clef",
    bottomLineStep: diatonicStep("G", 2),
    centerMidi: 50, // D3, middle line
    rangeLow: 40,
    rangeHigh: 60,
  },
  alto: {
    id: "alto",
    fr: "Clé d'ut",
    en: "Alto clef",
    bottomLineStep: diatonicStep("F", 3),
    centerMidi: 60, // C4, middle line
    rangeLow: 50,
    rangeHigh: 71,
  },
};

/**
 * Vertical staff position of a spelled note, measured in half-steps of staff
 * space from the BOTTOM line. 0 = on the bottom line, 1 = first space, 2 =
 * second line… Negative = below the bottom line (ledger territory).
 * This integer is exactly what the renderer multiplies by half the line gap.
 */
export function staffPosition(s: PitchSpelling, clef: Clef): number {
  return diatonicStep(s.letter, s.octave) - clef.bottomLineStep;
}

/** Convenience: staff position of a MIDI note in a clef + key. */
export function midiStaffPosition(midi: number, clef: Clef, key: KeySignature): number {
  return staffPosition(spellInKey(midi, key), clef);
}

// ── Key signatures ──────────────────────────────────────────────────────────

export type AccidentalType = "sharp" | "flat" | "none";

export interface KeySignature {
  id: string; // "G", "Eb", "C"
  /** Number of sharps (positive) or flats (negative). */
  count: number;
  accidentalType: AccidentalType;
  /** Tonic name (major). */
  tonic: string;
  /** Relative minor tonic. */
  relativeMinor: string;
  fr: string;
  en: string;
}

// Order accidentals appear in a signature.
export const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];

export const KEY_SIGNATURES: KeySignature[] = [
  { id: "C", count: 0, accidentalType: "none", tonic: "C", relativeMinor: "A", fr: "Do majeur", en: "C major" },
  { id: "G", count: 1, accidentalType: "sharp", tonic: "G", relativeMinor: "E", fr: "Sol majeur", en: "G major" },
  { id: "D", count: 2, accidentalType: "sharp", tonic: "D", relativeMinor: "B", fr: "Ré majeur", en: "D major" },
  { id: "A", count: 3, accidentalType: "sharp", tonic: "A", relativeMinor: "F#", fr: "La majeur", en: "A major" },
  { id: "E", count: 4, accidentalType: "sharp", tonic: "E", relativeMinor: "C#", fr: "Mi majeur", en: "E major" },
  { id: "B", count: 5, accidentalType: "sharp", tonic: "B", relativeMinor: "G#", fr: "Si majeur", en: "B major" },
  { id: "F#", count: 6, accidentalType: "sharp", tonic: "F#", relativeMinor: "D#", fr: "Fa♯ majeur", en: "F♯ major" },
  { id: "F", count: 1, accidentalType: "flat", tonic: "F", relativeMinor: "D", fr: "Fa majeur", en: "F major" },
  { id: "Bb", count: 2, accidentalType: "flat", tonic: "B♭", relativeMinor: "G", fr: "Si♭ majeur", en: "B♭ major" },
  { id: "Eb", count: 3, accidentalType: "flat", tonic: "E♭", relativeMinor: "C", fr: "Mi♭ majeur", en: "E♭ major" },
  { id: "Ab", count: 4, accidentalType: "flat", tonic: "A♭", relativeMinor: "F", fr: "La♭ majeur", en: "A♭ major" },
  { id: "Db", count: 5, accidentalType: "flat", tonic: "D♭", relativeMinor: "B♭", fr: "Ré♭ majeur", en: "D♭ major" },
  { id: "Gb", count: 6, accidentalType: "flat", tonic: "G♭", relativeMinor: "E♭", fr: "Sol♭ majeur", en: "G♭ major" },
];

export const KEY_BY_ID = Object.fromEntries(KEY_SIGNATURES.map((k) => [k.id, k]));

/** The letters that carry an accidental in a key signature, in print order. */
export function keyAccidentalLetters(key: KeySignature): Letter[] {
  if (key.accidentalType === "sharp") return SHARP_ORDER.slice(0, key.count);
  if (key.accidentalType === "flat") return FLAT_ORDER.slice(0, key.count);
  return [];
}

interface ScaleMember {
  letter: Letter;
  accidental: number; // -1, 0, +1
  pc: number; // 0..11
  semitoneFromC: number; // = pc, kept for clarity
}

/** The seven diatonic members of a major key, with letters + accidentals. */
export function keyScalePitchClasses(key: KeySignature): ScaleMember[] {
  const sharpened = new Set(key.accidentalType === "sharp" ? keyAccidentalLetters(key) : []);
  const flattened = new Set(key.accidentalType === "flat" ? keyAccidentalLetters(key) : []);
  return LETTERS.map((letter) => {
    let accidental = 0;
    if (sharpened.has(letter)) accidental = 1;
    else if (flattened.has(letter)) accidental = -1;
    const pc = (((LETTER_SEMITONE[letter] + accidental) % 12) + 12) % 12;
    return { letter, accidental, pc, semitoneFromC: pc };
  });
}

/** Pitch classes (0..11) that belong to a key's major scale. */
export function keyPitchClasses(key: KeySignature): number[] {
  return keyScalePitchClasses(key).map((m) => m.pc).sort((a, b) => a - b);
}

// ── Rhythm ──────────────────────────────────────────────────────────────────

export type DurationId = "w" | "h" | "q" | "8" | "16";

export interface DurationDef {
  id: DurationId;
  /** Length in beats (quarter = 1). */
  beats: number;
  fr: string;
  en: string;
}

export const DURATIONS: Record<DurationId, DurationDef> = {
  w: { id: "w", beats: 4, fr: "Ronde", en: "Whole" },
  h: { id: "h", beats: 2, fr: "Blanche", en: "Half" },
  q: { id: "q", beats: 1, fr: "Noire", en: "Quarter" },
  "8": { id: "8", beats: 0.5, fr: "Croche", en: "Eighth" },
  "16": { id: "16", beats: 0.25, fr: "Double-croche", en: "Sixteenth" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function fitMidiToRange(midi: number, min: number, max: number): number {
  let m = midi;
  while (m < min) m += 12;
  while (m > max) m -= 12;
  return m;
}
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A seeded PRNG (mulberry32) for the date-stamped "exercice du jour". */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a YYYY-MM-DD string into a stable integer seed. */
export function dateSeed(iso: string): number {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
