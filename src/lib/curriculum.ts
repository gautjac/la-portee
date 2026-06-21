// ─────────────────────────────────────────────────────────────────────────
// La Portée — the level ladder.
// A sensible progression for reading the staff: treble lines/spaces first,
// then ledger lines, then bass clef, then the grand staff, with key-signature
// and rhythm work woven in. Each level scopes the note pool, clefs and keys a
// drill draws from, so the reader meets new territory in order.
// ─────────────────────────────────────────────────────────────────────────

import type { ClefId } from "./music";

export interface Level {
  id: number;
  fr: string;
  en: string;
  /** One-line description of what this level covers. */
  descFr: string;
  descEn: string;
  clefs: ClefId[];
  /** Inclusive MIDI range for note-naming. */
  low: number;
  high: number;
  /** Key-signature ids in scope (by KEY_BY_ID). */
  keys: string[];
  /** Whether ledger lines appear at this level. */
  ledger: boolean;
}

export const LEVELS: Level[] = [
  {
    id: 1,
    fr: "Les lignes de sol",
    en: "Treble lines",
    descFr: "Les cinq lignes de la clé de sol : Mi-Sol-Si-Ré-Fa.",
    descEn: "The five treble lines: E-G-B-D-F.",
    clefs: ["treble"],
    low: 64, // E4
    high: 77, // F5 (top line)
    keys: ["C"],
    ledger: false,
  },
  {
    id: 2,
    fr: "Les interlignes",
    en: "Treble spaces",
    descFr: "Lignes ET interlignes de la clé de sol — toute la portée.",
    descEn: "Treble lines AND spaces — the whole staff.",
    clefs: ["treble"],
    low: 64,
    high: 79, // up to G5
    keys: ["C"],
    ledger: false,
  },
  {
    id: 3,
    fr: "Lignes supplémentaires",
    en: "Ledger lines",
    descFr: "Au-delà de la portée : do central et l'aigu, en lignes supplémentaires.",
    descEn: "Beyond the staff: middle C and the high range, on ledger lines.",
    clefs: ["treble"],
    low: 60, // C4 (ledger below)
    high: 84, // C6 (ledger above)
    keys: ["C"],
    ledger: true,
  },
  {
    id: 4,
    fr: "La clé de fa",
    en: "Bass clef",
    descFr: "Lire la clé de fa : Sol-Si-Ré-Fa-La et leurs interlignes.",
    descEn: "Reading bass clef: G-B-D-F-A and the spaces between.",
    clefs: ["bass"],
    low: 43, // G2
    high: 57, // A3
    keys: ["C"],
    ledger: false,
  },
  {
    id: 5,
    fr: "La clé de fa, élargie",
    en: "Bass, extended",
    descFr: "La clé de fa avec ses lignes supplémentaires, jusqu'au do central.",
    descEn: "Bass clef with its ledger lines, up to middle C.",
    clefs: ["bass"],
    low: 36, // C2
    high: 60, // C4
    keys: ["C"],
    ledger: true,
  },
  {
    id: 6,
    fr: "La grande portée",
    en: "Grand staff",
    descFr: "Les deux clés ensemble : la grande portée du piano.",
    descEn: "Both clefs together: the piano's grand staff.",
    clefs: ["treble", "bass"],
    low: 48, // C3
    high: 81, // A5
    keys: ["C"],
    ledger: true,
  },
  {
    id: 7,
    fr: "Une dièse, un bémol",
    en: "One sharp, one flat",
    descFr: "Lire avec une armure simple : Sol majeur et Fa majeur.",
    descEn: "Reading with a simple key signature: G major and F major.",
    clefs: ["treble", "bass"],
    low: 50,
    high: 79,
    keys: ["C", "G", "F"],
    ledger: true,
  },
  {
    id: 8,
    fr: "Toutes les armures",
    en: "All key signatures",
    descFr: "Jusqu'à six dièses ou six bémols — le cercle des quintes au complet.",
    descEn: "Up to six sharps or six flats — the full circle of fifths.",
    clefs: ["treble", "bass"],
    low: 48,
    high: 81,
    keys: ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db", "Gb"],
    ledger: true,
  },
];

export function levelById(id: number): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
