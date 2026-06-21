import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Card, Label } from "../components/ui";
import { useLang } from "../i18n";
import { makeRhythmQuestion, scoreRhythm, type RhythmQuestion, type RhythmScore } from "../lib/drills";
import { levelById } from "../lib/curriculum";
import { DURATIONS } from "../lib/music";
import { playTick, now as audioNow, unlockAudio } from "../lib/audio";
import { recordAttempt } from "../lib/db";

type Phase = "ready" | "counting" | "listen" | "tapping" | "scored";

export default function RhythmDrill({ level }: { level: number }) {
  const { t } = useLang();
  const [q, setQ] = useState<RhythmQuestion>(() => makeRhythmQuestion(levelById(level)));
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState<RhythmScore | null>(null);
  const [session, setSession] = useState({ ok: 0, total: 0 });
  const [flash, setFlash] = useState(false);
  const tapsRef = useRef<number[]>([]);
  const startMsRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const next = useCallback(() => {
    clearTimers();
    setQ(makeRhythmQuestion(levelById(level)));
    setPhase("ready");
    setScore(null);
    tapsRef.current = [];
  }, [level]);

  useEffect(() => {
    next();
  }, [level, next]);
  useEffect(() => () => clearTimers(), []);

  const beatMs = 60000 / q.bpm;

  // Play the rhythm: a count-in, then sound each onset.
  const playRhythm = useCallback(async () => {
    await unlockAudio();
    clearTimers();
    setPhase("counting");
    const t0 = audioNow();
    // count-in: one bar of clicks
    for (let b = 0; b < q.beatsPerBar; b++) {
      playTick(t0 + b * (beatMs / 1000), b === 0);
    }
    const musicStart = t0 + q.beatsPerBar * (beatMs / 1000);
    // schedule onsets (audible) + the phase flip to "listen"
    q.events.forEach((e) => {
      playTick(musicStart + e.beat * (beatMs / 1000), e.beat % q.beatsPerBar === 0);
    });
    const switchId = window.setTimeout(() => setPhase("listen"), q.beatsPerBar * beatMs);
    const endId = window.setTimeout(
      () => setPhase("ready"),
      (q.beatsPerBar + q.totalBeats + 0.5) * beatMs,
    );
    timersRef.current.push(switchId, endId);
  }, [q, beatMs]);

  // Start the user's tapping pass: a count-in, then record taps for totalBeats.
  const startTapping = useCallback(async () => {
    await unlockAudio();
    clearTimers();
    setPhase("counting");
    tapsRef.current = [];
    const t0 = audioNow();
    for (let b = 0; b < q.beatsPerBar; b++) {
      playTick(t0 + b * (beatMs / 1000), b === 0);
    }
    const tapStartId = window.setTimeout(() => {
      setPhase("tapping");
      startMsRef.current = performance.now();
    }, q.beatsPerBar * beatMs);
    const doneId = window.setTimeout(
      () => finishTapping(),
      (q.beatsPerBar + q.totalBeats + 0.7) * beatMs,
    );
    timersRef.current.push(tapStartId, doneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, beatMs]);

  const finishTapping = useCallback(() => {
    clearTimers();
    const targetBeats = q.events.map((e) => e.beat);
    const s = scoreRhythm(targetBeats, tapsRef.current, startMsRef.current, q.bpm);
    setScore(s);
    setPhase("scored");
    const passed = s.accuracy >= 0.6;
    setSession((p) => ({ ok: p.ok + (passed ? 1 : 0), total: p.total + 1 }));
    void recordAttempt("rhythm", q.itemId, passed, 0);
  }, [q]);

  const tap = useCallback(() => {
    if (phase !== "tapping") return;
    tapsRef.current.push(performance.now());
    setFlash(true);
    setTimeout(() => setFlash(false), 90);
    playTick(undefined, false);
  }, [phase]);

  // spacebar = tap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "tapping") tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tap]);

  return (
    <div className="animate-riseIn space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("frapper le rythme", "clap the rhythm")}</Label>
          <div className="font-serif text-xl text-ink">
            {q.bpm} {t("noires/min", "BPM")} · {q.beatsPerBar}/4
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono tnum text-lg font-700 text-sage">
            {session.ok}/{session.total}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">{t("réussis", "passed")}</div>
        </div>
      </div>

      {/* rhythm staff: single line with stemmed noteheads */}
      <Card className="px-3 py-5 sm:px-6">
        <RhythmStaff q={q} />
      </Card>

      {score && (
        <div className="animate-pop">
          <Card className={`px-4 py-3 text-center ${score.accuracy >= 0.6 ? "ring-1 ring-sage/40" : "ring-1 ring-terracotta/40"}`}>
            <div className="font-serif text-2xl" style={{ color: score.accuracy >= 0.6 ? "#46715a" : "#bb5a3c" }}>
              {Math.round(score.accuracy * 100)}%
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">
              {score.hits}/{score.total} {t("frappes", "onsets")} ·{" "}
              {t("écart moyen", "avg. error")} {Math.round(score.meanErrorMs)} ms
            </div>
          </Card>
        </div>
      )}

      {/* tap pad */}
      {(phase === "tapping" || phase === "counting") && (
        <button
          type="button"
          onPointerDown={tap}
          className={`key-press w-full rounded-2xl border-2 border-dashed py-10 text-center font-serif text-lg transition-colors ${
            flash ? "border-gold bg-gold/20" : "border-bordeaux/30 bg-paper-card"
          }`}
        >
          {phase === "counting"
            ? t("Décompte…", "Counting in…")
            : t("Frappe ici — ou la barre d'espace", "Tap here — or the spacebar")}
        </button>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {phase === "ready" && (
          <>
            <Btn variant="ghost" onClick={playRhythm}>
              {t("▶ Écouter le rythme", "▶ Hear the rhythm")}
            </Btn>
            <Btn variant="bordeaux" onClick={startTapping}>
              {t("Frapper en retour", "Clap it back")}
            </Btn>
          </>
        )}
        {phase === "listen" && (
          <Btn variant="bordeaux" onClick={startTapping}>
            {t("À ton tour →", "Your turn →")}
          </Btn>
        )}
        {phase === "scored" && (
          <>
            <Btn variant="ghost" onClick={startTapping}>
              {t("Réessayer", "Try again")}
            </Btn>
            <Btn variant="bordeaux" onClick={next}>
              {t("Nouveau rythme →", "New rhythm →")}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

/** A one-line rhythm staff: noteheads with stems + flags + beams kept simple. */
function RhythmStaff({ q }: { q: RhythmQuestion }) {
  const width = 540;
  const x0 = 30;
  const x1 = width - 24;
  const y = 50;
  const beatMs = (x1 - x0) / q.totalBeats;
  const beatX = (beat: number) => x0 + beat * beatMs;

  return (
    <svg viewBox={`0 0 ${width} 96`} className="w-full" role="img" aria-label="rythme">
      {/* baseline */}
      <line x1={x0} y1={y} x2={x1} y2={y} stroke="#b7a98a" strokeWidth={1.2} />
      {/* bar divisions */}
      {Array.from({ length: q.totalBeats / q.beatsPerBar + 1 }, (_, i) => i * q.beatsPerBar).map((b) => (
        <line key={b} x1={beatX(b)} y1={y - 26} x2={beatX(b)} y2={y + 14} stroke="#1c1a17" strokeWidth={b === 0 || b === q.totalBeats ? 2 : 1} opacity={b === 0 || b === q.totalBeats ? 1 : 0.35} />
      ))}
      {/* beat ticks */}
      {Array.from({ length: q.totalBeats }, (_, i) => i).map((b) => (
        <line key={`t${b}`} x1={beatX(b)} y1={y + 16} x2={beatX(b)} y2={y + 22} stroke="#b7a98a" strokeWidth={1} />
      ))}
      {/* notes */}
      {q.events.map((e, i) => {
        const x = beatX(e.beat);
        const filled = e.duration !== "h" && e.duration !== "w";
        const beats = DURATIONS[e.duration].beats;
        const flag = e.duration === "8" || e.duration === "16";
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={6.5} ry={5.2} fill={filled ? "#1c1a17" : "none"} stroke="#1c1a17" strokeWidth={filled ? 0 : 2} transform={`rotate(-18 ${x} ${y})`} />
            {beats < 4 && <line x1={x + 6} y1={y} x2={x + 6} y2={y - 30} stroke="#1c1a17" strokeWidth={1.8} strokeLinecap="round" />}
            {flag && (
              <path d={`M ${x + 6} ${y - 30} q 10 4 8 14`} stroke="#1c1a17" strokeWidth={2} fill="none" strokeLinecap="round" />
            )}
            {e.duration === "16" && (
              <path d={`M ${x + 6} ${y - 23} q 10 4 8 14`} stroke="#1c1a17" strokeWidth={2} fill="none" strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
