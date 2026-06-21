import { useCallback, useEffect, useRef, useState } from "react";
import Staff, { type StaffNote } from "../components/Staff";
import { Btn, Card, Label } from "../components/ui";
import { useLang } from "../i18n";
import { makeSightPhrase, type SightPhrase } from "../lib/drills";
import { levelById } from "../lib/curriculum";
import { DURATIONS } from "../lib/music";
import { playNote, playTick, unlockAudio, now as audioNow } from "../lib/audio";
import { recordAttempt } from "../lib/db";
import { startMic, type MicState } from "../lib/inputs";

type Phase = "ready" | "counting" | "playing" | "done";

export default function SightDrill({ level, useMic }: { level: number; useMic: boolean }) {
  const { t } = useLang();
  const [phrase, setPhrase] = useState<SightPhrase>(() => makeSightPhrase(levelById(level)));
  const [phase, setPhase] = useState<Phase>("ready");
  const [cursorBeat, setCursorBeat] = useState(0);
  const [hitNotes, setHitNotes] = useState<Set<number>>(new Set());
  const [tempoPct, setTempoPct] = useState(100);
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null);
  const [mic, setMic] = useState<MicState>("idle");

  const rafRef = useRef(0);
  const startRef = useRef(0);
  const micRef = useRef<{ stop: () => void } | null>(null);
  const noteXsRef = useRef<number[]>([]);
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;
  const hitRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const bpm = Math.round(phrase.bpm * (tempoPct / 100));
  const beatMs = 60000 / bpm;

  const stopMic = () => {
    micRef.current?.stop();
    micRef.current = null;
    setMic("idle");
  };

  const next = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopMic();
    setPhrase(makeSightPhrase(levelById(level)));
    setPhase("ready");
    setCursorBeat(0);
    setHitNotes(new Set());
    hitRef.current = new Set();
    setScore(null);
  }, [level]);

  useEffect(() => {
    next();
  }, [level, next]);
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    stopMic();
  }, []);

  // mark a note as "played correctly" when its pitch class is heard near its beat
  const registerPitch = useCallback((midi: number) => {
    if (phaseRef.current !== "playing") return;
    const p = phraseRef.current;
    const elapsedBeats = (performance.now() - startRef.current) / beatMs;
    const pc = ((midi % 12) + 12) % 12;
    // find the active/nearby note within ±0.6 beat whose pitch class matches
    for (let i = 0; i < p.notes.length; i++) {
      if (hitRef.current.has(i)) continue;
      const n = p.notes[i];
      const dur = DURATIONS[n.duration].beats;
      if (elapsedBeats >= n.beat - 0.6 && elapsedBeats <= n.beat + dur + 0.4) {
        if (((n.midi % 12) + 12) % 12 === pc) {
          hitRef.current.add(i);
          setHitNotes(new Set(hitRef.current));
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatMs]);

  const start = useCallback(async () => {
    await unlockAudio();
    const p = phraseRef.current;
    setPhase("counting");
    setHitNotes(new Set());
    hitRef.current = new Set();

    if (useMic && !micRef.current) {
      const h = await startMic((m) => registerPitch(m), setMic);
      if (h) micRef.current = h;
    }

    const t0 = audioNow();
    for (let b = 0; b < p.beatsPerBar; b++) {
      playTick(t0 + b * (beatMs / 1000), b === 0);
    }

    window.setTimeout(() => {
      setPhase("playing");
      startRef.current = performance.now();
      // sound the melody so the user hears the target while reading
      let acc = audioNow();
      for (const n of p.notes) {
        const d = DURATIONS[n.duration].beats * (beatMs / 1000);
        playNote(n.midi, d * 0.92, acc - audioNow());
        acc += d;
      }
      const loop = () => {
        const elapsed = (performance.now() - startRef.current) / beatMs;
        setCursorBeat(elapsed);
        if (elapsed >= p.totalBeats + 0.3) {
          finish();
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }, p.beatsPerBar * beatMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatMs, useMic, registerPitch]);

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopMic();
    const p = phraseRef.current;
    const hit = hitRef.current.size;
    const total = p.notes.length;
    setScore({ hit, total });
    setPhase("done");
    if (useMic) {
      const passed = total > 0 && hit / total >= 0.6;
      void recordAttempt("sight", p.itemId, passed, 0);
    } else {
      // without mic we can't score input; still log engagement as a soft pass
      void recordAttempt("sight", p.itemId, true, 0);
    }
  }, [useMic]);

  // build staff notes with per-note state
  const staffNotes: StaffNote[] = phrase.notes.map((n, i) => {
    const dur = DURATIONS[n.duration].beats;
    const isActive = phase === "playing" && cursorBeat >= n.beat && cursorBeat < n.beat + dur;
    const isHit = hitNotes.has(i);
    return {
      midi: n.midi,
      duration: n.duration,
      state: isHit ? "correct" : isActive ? "active" : "default",
    };
  });

  // cursor x position from the note layout
  const playheadX = (() => {
    if (phase !== "playing" || noteXsRef.current.length === 0) return null;
    const xs = noteXsRef.current;
    // interpolate between note x's by beat
    const beats = phrase.notes.map((n) => n.beat);
    let i = 0;
    while (i < beats.length - 1 && beats[i + 1] <= cursorBeat) i++;
    const x0 = xs[i] ?? xs[0];
    const x1v = xs[i + 1] ?? x0 + 40;
    const b0 = beats[i] ?? 0;
    const b1 = beats[i + 1] ?? b0 + 1;
    const frac = b1 > b0 ? Math.min(1, Math.max(0, (cursorBeat - b0) / (b1 - b0))) : 0;
    return x0 + (x1v - x0) * frac;
  })();

  return (
    <div className="animate-riseIn space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("déchiffrage défilant", "scrolling sight-reading")}</Label>
          <div className="font-serif text-xl text-ink">
            {phrase.clef.id === "treble" ? t("Clé de sol", "Treble") : t("Clé de fa", "Bass")}
            {phrase.key.id !== "C" && <span className="text-ink-faint"> · {t(phrase.key.fr, phrase.key.en)}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono tnum text-lg font-700 text-bordeaux">{bpm}</div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{t("noires/min", "BPM")}</div>
        </div>
      </div>

      <Card className="px-3 py-4 sm:px-6">
        <Staff
          clef={phrase.clef}
          keySig={phrase.key}
          notes={staffNotes}
          width={560}
          playheadX={playheadX}
          onLayout={(xs) => (noteXsRef.current = xs)}
        />
      </Card>

      {/* tempo control */}
      <div className="flex items-center gap-3 px-1">
        <Label>{t("tempo", "tempo")}</Label>
        <input
          type="range"
          min={50}
          max={130}
          step={5}
          value={tempoPct}
          onChange={(e) => setTempoPct(parseInt(e.target.value, 10))}
          className="flex-1"
          disabled={phase === "playing" || phase === "counting"}
        />
        <span className="font-mono tnum text-xs text-ink-faint">{tempoPct}%</span>
      </div>

      {useMic && phase === "playing" && (
        <p className="text-center text-sm text-ink-soft">
          <span className="mr-2 inline-block h-2 w-2 animate-quill rounded-full bg-sage align-middle" />
          {mic === "listening"
            ? t("Joue ou chante chaque note sous le curseur.", "Play or sing each note under the cursor.")
            : t("Micro en préparation…", "Mic warming up…")}
        </p>
      )}

      {score && (
        <div className="animate-pop">
          <Card className="px-4 py-3 text-center ring-1 ring-bordeaux/30">
            {useMic ? (
              <>
                <div className="font-serif text-2xl text-bordeaux">
                  {score.total > 0 ? Math.round((score.hit / score.total) * 100) : 0}%
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {score.hit}/{score.total} {t("notes lues juste", "notes read correctly")}
                </div>
              </>
            ) : (
              <div className="font-serif text-lg text-ink">
                {t("Phrase terminée. Active le micro pour un score en direct.", "Phrase finished. Turn on the mic for live scoring.")}
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {(phase === "ready" || phase === "done") && (
          <>
            <Btn variant="bordeaux" onClick={start}>
              {phase === "done" ? t("Rejouer", "Replay") : t("▶ Lancer", "▶ Start")}
            </Btn>
            <Btn variant="ghost" onClick={next}>
              {t("Nouvelle phrase →", "New phrase →")}
            </Btn>
          </>
        )}
        {(phase === "playing" || phase === "counting") && (
          <Btn variant="ghost" onClick={finish}>
            {t("Arrêter", "Stop")}
          </Btn>
        )}
      </div>
    </div>
  );
}
