import { useMemo } from "react";
import type { Clef, KeySignature, DurationId } from "../lib/music";
import {
  STAFF_TOP,
  STAFF_BOTTOM,
  STAFF_GAP,
  HALF,
  NOTE_RX,
  NOTE_RY,
  staffLines,
  clefGlyph,
  keySignatureGlyphs,
  layoutNote,
  yForPosition,
  type NoteGlyph,
} from "../lib/notation";

const INK = "#1c1a17";
const RULE = "#b7a98a";

export interface StaffNote {
  midi: number;
  duration: DurationId;
  /** highlight state */
  state?: "default" | "active" | "correct" | "wrong" | "ghost";
}

interface StaffProps {
  clef: Clef;
  keySig: KeySignature;
  notes: StaffNote[];
  /** Fixed x spacing per note; if omitted, spread evenly across width. */
  width?: number;
  /** Optional playhead x (in the same coordinate space as notes). */
  playheadX?: number | null;
  /** show a final barline */
  barline?: boolean;
  /** extra vertical padding for ledger lines */
  pad?: number;
  className?: string;
  /** Called with the computed x of each note (for scroll syncing). */
  onLayout?: (xs: number[]) => void;
}

const STATE_COLOR: Record<string, string> = {
  default: INK,
  active: "#b8893a", // gold
  correct: "#46715a", // sage
  wrong: "#bb5a3c", // terracotta
  ghost: "#9a9180",
};

function Flag({ note, color }: { note: NoteGlyph; color: string }) {
  if (!note.flag || !note.flagAt) return null;
  const { x, y } = note.flagAt;
  const dir = note.stemUp ? 1 : -1;
  // a simple engraved flag curve; double for 16ths
  const make = (oy: number) =>
    note.stemUp
      ? `M ${x} ${y + oy} q ${STAFF_GAP * 1.2} ${STAFF_GAP * 0.7} ${STAFF_GAP * 0.9} ${STAFF_GAP * 2.2}`
      : `M ${x} ${y + oy} q ${STAFF_GAP * 1.2} ${-STAFF_GAP * 0.7} ${STAFF_GAP * 0.9} ${-STAFF_GAP * 2.2}`;
  return (
    <g stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round">
      <path d={make(0)} />
      {note.flag === "16" && <path d={make(dir * STAFF_GAP * 0.9)} />}
    </g>
  );
}

export default function Staff({
  clef,
  keySig,
  notes,
  width = 560,
  playheadX = null,
  barline = true,
  pad = 44,
  className = "",
  onLayout,
}: StaffProps) {
  const layout = useMemo(() => {
    const clefG = clefGlyph(clef);
    const afterClef = 30 + STAFF_GAP * 2.4;
    const { glyphs: keyGlyphs, endX } = keySignatureGlyphs(keySig, clef, afterClef);
    const musicStart = endX + STAFF_GAP * 1.6;
    const musicEnd = width - STAFF_GAP * 2.2;
    const n = Math.max(1, notes.length);
    const span = musicEnd - musicStart;
    const step = n > 1 ? span / (n - 1) : 0;
    const noteGlyphs = notes.map((sn, i) => {
      const x = n === 1 ? (musicStart + musicEnd) / 2 : musicStart + i * step;
      return { glyph: layoutNote(sn.midi, clef, keySig, sn.duration, x), sn };
    });
    return { clefG, keyGlyphs, noteGlyphs, musicStart };
  }, [clef, keySig, notes, width]);

  // report note x positions once per layout
  useMemo(() => {
    if (onLayout) onLayout(layout.noteGlyphs.map((ng) => ng.glyph.x));
  }, [layout, onLayout]);

  const lines = staffLines(20, width - 12);
  const height = STAFF_BOTTOM + pad;
  const top = STAFF_TOP - pad;

  return (
    <svg
      viewBox={`0 ${top} ${width} ${height - top}`}
      className={`w-full ${className}`}
      role="img"
      aria-label="portée musicale"
    >
      {/* staff lines */}
      <g stroke={RULE} strokeWidth={1.1}>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>

      {/* clef */}
      <text
        x={layout.clefG.x}
        y={layout.clefG.y}
        fontSize={layout.clefG.size}
        fill={INK}
        fontFamily="'Cormorant Garamond', Georgia, serif"
      >
        {layout.clefG.char}
      </text>

      {/* key signature */}
      {layout.keyGlyphs.map((g, i) => (
        <text
          key={i}
          x={g.x}
          y={g.y}
          fontSize={g.size}
          fill={INK}
          fontFamily="'Cormorant Garamond', Georgia, serif"
          textAnchor="middle"
        >
          {g.char}
        </text>
      ))}

      {/* playhead */}
      {playheadX != null && (
        <line
          x1={playheadX}
          y1={STAFF_TOP - STAFF_GAP * 2.4}
          x2={playheadX}
          y2={STAFF_BOTTOM + STAFF_GAP * 2.4}
          stroke="#b8893a"
          strokeWidth={2}
          opacity={0.85}
        />
      )}

      {/* notes */}
      {layout.noteGlyphs.map(({ glyph, sn }, i) => {
        const color = STATE_COLOR[sn.state ?? "default"];
        return (
          <g key={i} className="ink-settle" style={{ animationDelay: `${i * 0.02}s` }}>
            {/* ledger lines */}
            <g stroke={color} strokeWidth={1.4}>
              {glyph.ledger.map((l, j) => (
                <line key={j} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              ))}
            </g>
            {/* accidental */}
            {glyph.accidental && (
              <text
                x={glyph.accidental.x}
                y={glyph.accidental.y}
                fontSize={glyph.accidental.size}
                fill={color}
                fontFamily="'Cormorant Garamond', Georgia, serif"
                textAnchor="middle"
              >
                {glyph.accidental.char}
              </text>
            )}
            {/* stem */}
            {glyph.stem && (
              <line
                x1={glyph.stem.x1}
                y1={glyph.stem.y1}
                x2={glyph.stem.x2}
                y2={glyph.stem.y2}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            {/* flag */}
            <Flag note={glyph} color={color} />
            {/* notehead */}
            <ellipse
              cx={glyph.head.cx}
              cy={glyph.head.cy}
              rx={glyph.head.rx}
              ry={glyph.head.ry}
              fill={glyph.head.filled ? color : "none"}
              stroke={color}
              strokeWidth={glyph.head.filled ? 0 : 2.2}
              transform={`rotate(${glyph.head.rotate} ${glyph.head.cx} ${glyph.head.cy})`}
            />
          </g>
        );
      })}

      {/* final barline */}
      {barline && (
        <line
          x1={width - 14}
          y1={STAFF_TOP}
          x2={width - 14}
          y2={STAFF_BOTTOM}
          stroke={INK}
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

/** A grand-staff (two staves braced) for the grand-staff drills. */
export function GrandStaff({
  trebleClef,
  bassClef,
  keySig,
  treble,
  bass,
  width = 560,
}: {
  trebleClef: Clef;
  bassClef: Clef;
  keySig: KeySignature;
  treble: StaffNote[];
  bass: StaffNote[];
  width?: number;
}) {
  return (
    <div className="space-y-1">
      <Staff clef={trebleClef} keySig={keySig} notes={treble} width={width} barline={false} />
      <Staff clef={bassClef} keySig={keySig} notes={bass} width={width} />
    </div>
  );
}

export { yForPosition, NOTE_RX, NOTE_RY, HALF };
