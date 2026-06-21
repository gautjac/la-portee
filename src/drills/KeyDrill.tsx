import { useCallback, useEffect, useRef, useState } from "react";
import Staff from "../components/Staff";
import { Btn, Card, Label } from "../components/ui";
import { useLang } from "../i18n";
import { makeKeyQuestion, type KeyQuestion } from "../lib/drills";
import { levelById } from "../lib/curriculum";
import { KEY_BY_ID } from "../lib/music";
import { recordAttempt } from "../lib/db";
import { playChord, unlockAudio } from "../lib/audio";
import { noteToMidi } from "../lib/music";

export default function KeyDrill({ level }: { level: number }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState<KeyQuestion>(() => makeKeyQuestion(levelById(level)));
  const [result, setResult] = useState<null | "correct" | "wrong">(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0, streak: 0 });
  const askedAt = useRef(Date.now());
  const resolvedRef = useRef(false);
  resolvedRef.current = result !== null;

  const next = useCallback(() => {
    setQ(makeKeyQuestion(levelById(level)));
    setResult(null);
    setPicked(null);
    askedAt.current = Date.now();
  }, [level]);

  useEffect(() => {
    next();
  }, [level, next]);

  const answer = useCallback(
    (keyId: string) => {
      if (resolvedRef.current) return;
      const correct = keyId === q.key.id;
      setPicked(keyId);
      setResult(correct ? "correct" : "wrong");
      void recordAttempt("key", q.key.id, correct, Date.now() - askedAt.current);
      setScore((s) => ({
        ok: s.ok + (correct ? 1 : 0),
        total: s.total + 1,
        streak: correct ? s.streak + 1 : 0,
      }));
      // play the tonic triad as a reward / confirmation
      void unlockAudio().then(() => {
        try {
          const root = noteToMidi(q.key.tonic.replace("♯", "#").replace("♭", "b") + "3");
          playChord([root, root + 4, root + 7], true);
        } catch {
          /* ignore unparseable tonic */
        }
      });
      if (correct) setTimeout(() => next(), 1000);
    },
    [q, next],
  );

  return (
    <div className="animate-riseIn space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("reconnaître l'armure", "name the key signature")}</Label>
          <div className="font-serif text-xl text-ink">{t("Quelle tonalité ?", "Which key?")}</div>
        </div>
        <div className="text-right">
          <div className="font-mono tnum text-lg font-700 text-sage">
            {score.ok}/{score.total}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            {t("série", "streak")} {score.streak}
          </div>
        </div>
      </div>

      <Card className="px-3 py-4 sm:px-6">
        <Staff clef={q.clef} keySig={q.key} notes={[]} width={420} barline={false} />
      </Card>

      {result && (
        <div className="animate-pop">
          <Card className={`px-4 py-3 text-center ${result === "correct" ? "ring-1 ring-sage/40" : "ring-1 ring-terracotta/40"}`}>
            <div className="font-serif text-lg" style={{ color: result === "correct" ? "#46715a" : "#bb5a3c" }}>
              {result === "correct" ? t("Juste ✓", "Correct ✓") : `${t("C'était", "It was")} ${t(q.key.fr, q.key.en)}`}
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">
              {t("relatif mineur", "relative minor")} : {q.key.relativeMinor}
              {lang === "fr" ? " mineur" : " minor"}
            </div>
            {result === "wrong" && (
              <Btn variant="bordeaux" className="mt-2" onClick={next}>
                {t("Suivante →", "Next →")}
              </Btn>
            )}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {q.options.map((id) => {
          const k = KEY_BY_ID[id];
          const isPicked = picked === id;
          const showRight = result && id === q.key.id;
          return (
            <button
              key={id}
              type="button"
              disabled={!!result}
              onClick={() => answer(id)}
              className={`key-press rounded-xl border px-4 py-3 text-left font-serif text-base font-600 transition-all disabled:opacity-70 ${
                showRight
                  ? "border-sage bg-sage text-paper-card"
                  : isPicked
                    ? "border-terracotta bg-terracotta text-paper-card"
                    : "border-paper-edge bg-paper-card text-ink hover:border-indigo/40 hover:bg-paper-deep"
              }`}
            >
              {t(k.fr, k.en)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
