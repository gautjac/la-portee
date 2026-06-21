// ─────────────────────────────────────────────────────────────────────────
// La Portée — the engraving layer.
// Hand-rolled SVG geometry for real, correct music notation: staves, clefs,
// key signatures, noteheads with stems / ledger lines / accidentals, and
// rhythm figures. Pure geometry returned as primitive shapes; React draws
// them. This is deliberately framework-free so it can be reasoned about and
// (where it's pure layout math) unit-tested.
// ─────────────────────────────────────────────────────────────────────────

import {
  type Clef,
  type KeySignature,
  type PitchSpelling,
  type DurationId,
  spellInKey,
  staffPosition,
  keyAccidentalLetters,
  SHARP_ORDER,
  diatonicStep,
  DURATIONS,
} from "./music";

// Engraving constants. STAFF_GAP = distance between two adjacent staff lines.
export const STAFF_GAP = 12; // px between lines
export const HALF = STAFF_GAP / 2; // one staff-position step
export const NOTE_RX = HALF * 1.18;
export const NOTE_RY = HALF * 0.92;
export const STEM_LEN = STAFF_GAP * 3.3;
export const STAFF_TOP = 46; // y of the TOP line within a system
export const STAFF_LINES = 5;
// y of the bottom line:
export const STAFF_BOTTOM = STAFF_TOP + (STAFF_LINES - 1) * STAFF_GAP;

/** y-coordinate of a staff position (0 = bottom line, +up). */
export function yForPosition(pos: number): number {
  return STAFF_BOTTOM - pos * HALF;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Engraver's tilt of the notehead, in degrees. */
  rotate: number;
  filled: boolean;
}

export interface LineSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Glyph {
  /** Unicode music glyph (clefs, accidentals, rests). */
  char: string;
  x: number;
  y: number;
  size: number;
}

export interface NoteGlyph {
  midi: number;
  spelling: PitchSpelling;
  /** staff position (0 = bottom line). */
  pos: number;
  head: Ellipse;
  stem: LineSeg | null;
  /** Flag char for 8th/16th (rendered as glyph at stem tip), or null. */
  flag: string | null;
  flagAt: { x: number; y: number } | null;
  ledger: LineSeg[];
  accidental: Glyph | null;
  /** Whether the stem points up. */
  stemUp: boolean;
  /** Center x of the notehead. */
  x: number;
}

// Unicode musical symbols (render with a serif font that carries them).
export const GLYPH = {
  treble: "𝄞", // 𝄞
  bass: "𝄢", // 𝄢
  alto: "𝄡", // 𝄡
  sharp: "♯", // ♯
  flat: "♭", // ♭
  natural: "♮", // ♮
  flag8up: "𝅮", // combining-ish; we draw flags manually instead
  restQuarter: "𝄽",
} as const;

export function clefGlyph(clef: Clef): Glyph {
  // The clef sits anchored to its reference line; we nudge per clef so it reads.
  if (clef.id === "treble") {
    return { char: GLYPH.treble, x: 8, y: STAFF_BOTTOM + STAFF_GAP * 0.95, size: STAFF_GAP * 7.2 };
  }
  if (clef.id === "bass") {
    return { char: GLYPH.bass, x: 8, y: STAFF_TOP + STAFF_GAP * 1.05, size: STAFF_GAP * 5.0 };
  }
  return { char: GLYPH.alto, x: 8, y: STAFF_TOP + STAFF_GAP * 2 + STAFF_GAP * 1.0, size: STAFF_GAP * 5.0 };
}

/** Build the staff's five horizontal lines across a width. */
export function staffLines(x0: number, x1: number): LineSeg[] {
  const lines: LineSeg[] = [];
  for (let i = 0; i < STAFF_LINES; i++) {
    const y = STAFF_TOP + i * STAFF_GAP;
    lines.push({ x1: x0, y1: y, x2: x1, y2: y });
  }
  return lines;
}

/**
 * Lay out the key-signature accidentals after the clef. Returns the glyphs and
 * the x where music can start.
 */
export function keySignatureGlyphs(
  key: KeySignature,
  clef: Clef,
  startX: number,
): { glyphs: Glyph[]; endX: number } {
  const letters = keyAccidentalLetters(key);
  const glyphs: Glyph[] = [];
  let x = startX;
  const isSharp = key.accidentalType === "sharp";
  for (const letter of letters) {
    // Place each accidental on the staff position its letter occupies in the
    // clef's display octave. Sharps and flats use the conventional octave.
    const octave = signatureOctave(letter, clef, isSharp);
    const pos = diatonicStep(letter, octave) - clef.bottomLineStep;
    const y = yForPosition(pos);
    glyphs.push({
      char: isSharp ? GLYPH.sharp : GLYPH.flat,
      x,
      y: y + (isSharp ? HALF * 0.05 : -HALF * 0.1),
      size: STAFF_GAP * 2.6,
    });
    x += STAFF_GAP * 1.05;
  }
  return { glyphs, endX: x + (letters.length ? STAFF_GAP * 0.6 : 0) };
}

/** Conventional octave for a signature accidental so it sits in-staff. */
function signatureOctave(letter: string, clef: Clef, isSharp: boolean): number {
  // Treble standard layout positions.
  const trebleSharp: Record<string, number> = { F: 5, C: 5, G: 5, D: 5, A: 4, E: 5, B: 4 };
  const trebleFlat: Record<string, number> = { B: 4, E: 5, A: 4, D: 5, G: 4, C: 5, F: 4 };
  let oct = isSharp ? trebleSharp[letter] : trebleFlat[letter];
  if (oct === undefined) oct = 5;
  if (clef.id === "bass") oct -= 2;
  if (clef.id === "alto") oct -= 1;
  return oct;
}

/**
 * Build a complete note glyph (head, stem, flag, ledger lines, accidental) at
 * a given x, for a MIDI note in a clef + key + duration.
 */
export function layoutNote(
  midi: number,
  clef: Clef,
  key: KeySignature,
  duration: DurationId,
  x: number,
): NoteGlyph {
  const spelling = spellInKey(midi, key);
  const pos = staffPosition(spelling, clef);
  const cy = yForPosition(pos);
  const filled = duration === "q" || duration === "8" || duration === "16";
  const hasStem = duration !== "w";

  // Stems point down for notes on/above the middle line, up for below.
  const stemUp = pos < 4;

  const head: Ellipse = {
    cx: x,
    cy,
    rx: NOTE_RX,
    ry: NOTE_RY,
    rotate: -20,
    filled,
  };

  let stem: LineSeg | null = null;
  let flag: string | null = null;
  let flagAt: { x: number; y: number } | null = null;
  if (hasStem) {
    const sx = stemUp ? x + NOTE_RX * 0.92 : x - NOTE_RX * 0.92;
    const sy = cy;
    const ty = stemUp ? cy - STEM_LEN : cy + STEM_LEN;
    stem = { x1: sx, y1: sy, x2: sx, y2: ty };
    if (duration === "8" || duration === "16") {
      flag = duration === "8" ? "8" : "16";
      flagAt = { x: sx, y: ty };
    }
  }

  // Ledger lines: when pos < -1 (below bottom line) or pos > 9 (above top line).
  const ledger: LineSeg[] = [];
  const lx0 = x - NOTE_RX * 1.6;
  const lx1 = x + NOTE_RX * 1.6;
  if (pos < 0) {
    for (let p = -2; p >= pos - (pos % 2 === 0 ? 0 : 1); p -= 2) {
      if (p < 0) {
        const y = yForPosition(p);
        ledger.push({ x1: lx0, y1: y, x2: lx1, y2: y });
      }
    }
  } else if (pos > 8) {
    for (let p = 10; p <= pos + (pos % 2 === 0 ? 0 : 1); p += 2) {
      const y = yForPosition(p);
      ledger.push({ x1: lx0, y1: y, x2: lx1, y2: y });
    }
  }

  // Accidental: drawn only when the note's accidental differs from the key.
  let accidental: Glyph | null = null;
  const acc = printedAccidental(midi, spelling, key);
  if (acc) {
    accidental = {
      char: acc,
      x: x - NOTE_RX * 2.7,
      y: cy + (acc === GLYPH.flat ? -HALF * 0.1 : HALF * 0.1),
      size: STAFF_GAP * 2.5,
    };
  }

  return { midi, spelling, pos, head, stem, flag, flagAt, ledger, accidental, stemUp, x };
}

/**
 * Decide which accidental (if any) must be PRINTED in front of a note, given
 * the key signature already covers some. Returns a glyph char or null.
 */
export function printedAccidental(
  _midi: number,
  spelling: PitchSpelling,
  key: KeySignature,
): string | null {
  const sigLetters = new Set(keyAccidentalLetters(key));
  const inSig = sigLetters.has(spelling.letter as never);
  const sigSign = key.accidentalType === "sharp" ? 1 : key.accidentalType === "flat" ? -1 : 0;

  if (inSig) {
    // The key already alters this letter. If the note matches that alteration,
    // print nothing; if it's natural, print a natural.
    if (spelling.accidental === sigSign) return null;
    if (spelling.accidental === 0) return GLYPH.natural;
    return spelling.accidental > 0 ? GLYPH.sharp : GLYPH.flat;
  }
  // Letter not in the signature: print only if it carries an accidental.
  if (spelling.accidental === 0) return null;
  return spelling.accidental > 0 ? GLYPH.sharp : GLYPH.flat;
}

/** Beats for a duration (re-exported for the rhythm renderer). */
export function durationBeats(d: DurationId): number {
  return DURATIONS[d].beats;
}

export { SHARP_ORDER };
