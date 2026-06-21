import { useEffect, useMemo, useRef } from "react";
import { midiToNote } from "../lib/music";

interface PianoProps {
  low?: number;
  high?: number;
  highlight?: number[]; // gold
  correct?: number[]; // sage
  wrong?: number[]; // terracotta
  onNote?: (midi: number) => void;
  /** Map computer keys to play, anchored at this MIDI. */
  keyboardAnchor?: number | null;
  labelMode?: "letters" | "solfege" | "none";
  disabled?: boolean;
}

const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
const BLACK_PC = [1, 3, 6, 8, 10];
const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
  o: 13, l: 14, p: 15, ";": 16,
};

export default function Piano({
  low = 60,
  high = 84,
  highlight = [],
  correct = [],
  wrong = [],
  onNote,
  keyboardAnchor = null,
  labelMode = "letters",
  disabled = false,
}: PianoProps) {
  const whites = useMemo(() => {
    const arr: number[] = [];
    for (let m = low; m <= high; m++) {
      if (WHITE_PC.includes(((m % 12) + 12) % 12)) arr.push(m);
    }
    return arr;
  }, [low, high]);

  const blacks = useMemo(() => {
    const arr: { midi: number; leftIndex: number }[] = [];
    for (let m = low; m <= high; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (BLACK_PC.includes(pc)) {
        let leftIndex = -1;
        for (let i = 0; i < whites.length; i++) {
          if (whites[i] < m) leftIndex = i;
          else break;
        }
        if (leftIndex >= 0) arr.push({ midi: m, leftIndex });
      }
    }
    return arr;
  }, [low, high, whites]);

  const hlSet = useMemo(() => new Set(highlight), [highlight]);
  const okSet = useMemo(() => new Set(correct), [correct]);
  const koSet = useMemo(() => new Set(wrong), [wrong]);

  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  useEffect(() => {
    if (keyboardAnchor == null || disabled) return;
    const held = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k in KEY_MAP && !held.has(k)) {
        held.add(k);
        onNoteRef.current?.(keyboardAnchor + KEY_MAP[k]);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [keyboardAnchor, disabled]);

  const whiteW = 100 / whites.length;

  const colorFor = (m: number, black: boolean) => {
    if (koSet.has(m)) return black ? "#9a4632" : "#bb5a3c";
    if (okSet.has(m)) return black ? "#365848" : "#46715a";
    if (hlSet.has(m)) return black ? "#9a6f2c" : "#b8893a";
    return null;
  };

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: `${whites.length * 0.6} / 1` }}
    >
      <div className="absolute inset-0 flex gap-[2px]">
        {whites.map((m) => {
          const c = colorFor(m, false);
          const isC = ((m % 12) + 12) % 12 === 0;
          const n = midiToNote(m);
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onPointerDown={() => !disabled && onNote?.(m)}
              className="key-press relative flex-1 rounded-b-md border border-paper-edge/80 transition-colors active:brightness-105"
              style={{
                background: c
                  ? `linear-gradient(180deg, ${c}, ${c}d8)`
                  : "linear-gradient(180deg,#fdfaf2,#ece3d0)",
                boxShadow: c
                  ? `0 0 14px ${c}55`
                  : "inset 0 -5px 9px rgba(28,26,23,0.08)",
              }}
            >
              {labelMode !== "none" && isC && (
                <span
                  className="pointer-events-none absolute bottom-1 left-0 right-0 text-center font-mono text-[9px] font-600"
                  style={{ color: c ? "#fbf6ea" : "#9a9180" }}
                >
                  {labelMode === "solfege" ? `do${n.octave}` : `C${n.octave}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {blacks.map(({ midi, leftIndex }) => {
        const c = colorFor(midi, true);
        const left = (leftIndex + 1) * whiteW;
        return (
          <button
            key={midi}
            type="button"
            disabled={disabled}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!disabled) onNote?.(midi);
            }}
            className="key-press absolute top-0 z-10 rounded-b-md transition-colors active:brightness-110"
            style={{
              left: `calc(${left}% - ${whiteW * 0.3}%)`,
              width: `${whiteW * 0.6}%`,
              height: "60%",
              background: c
                ? `linear-gradient(180deg, ${c}, ${c}bb)`
                : "linear-gradient(180deg,#3a352c,#1c1a17)",
              boxShadow: c
                ? `0 0 12px ${c}88`
                : "0 3px 6px rgba(28,26,23,0.4), inset 0 -2px 5px rgba(0,0,0,0.5)",
              border: "1px solid rgba(28,26,23,0.5)",
            }}
          />
        );
      })}
    </div>
  );
}
