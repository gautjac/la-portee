import { useCallback, useEffect, useRef, useState } from "react";
import Staff from "../components/Staff";
import Piano from "../components/Piano";
import { Btn, Card, Label } from "../components/ui";
import { useLang } from "../i18n";
import {
  makeNoteQuestion,
  letterOptions,
  letterLabel,
  noteItemId,
  type NoteQuestion,
  type NoteNameMode,
} from "../lib/drills";
import { levelById } from "../lib/curriculum";
import { spellInKey, midiToNote, type Letter, LETTERS } from "../lib/music";
import { playNote, unlockAudio } from "../lib/audio";
import { recordAttempt } from "../lib/db";
import { startMic, type MicState } from "../lib/inputs";

type InputMode = "buttons" | "piano" | "mic";

export default function NoteDrill({
  level,
  nameMode,
  inputMode,
}: {
  level: number;
  nameMode: NoteNameMode;
  inputMode: InputMode;
}) {
  const { t } = useLang();
  const lvl = levelById(level);
  const [q, setQ] = useState<NoteQuestion>(() => makeNoteQuestion(lvl));
  const [result, setResult] = useState<null | "correct" | "wrong">(null);
  const [picked, setPicked] = useState<Letter | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0, streak: 0 });
  const [mic, setMic] = useState<MicState>("idle");
  const micRef = useRef<{ stop: () => void } | null>(null);
  const askedAt = useRef(Date.now());
  const qRef = useRef(q);
  qRef.current = q;
  const resolvedRef = useRef(false);
  resolvedRef.current = result !== null;

  const next = useCallback(() => {
    setQ(makeNoteQuestion(levelById(level)));
    setResult(null);
    setPicked(null);
    askedAt.current = Date.now();
  }, [level]);

  // regenerate when level changes
  useEffect(() => {
    next();
  }, [level, next]);

  const answer = useCallback(
    (letter: Letter) => {
      if (resolvedRef.current) return;
      const cur = qRef.current;
      const correct = letter === cur.answer;
      setPicked(letter);
      setResult(correct ? "correct" : "wrong");
      void unlockAudio().then(() => playNote(cur.midi, 1.3));
      void recordAttempt("note", noteItemId(cur.clef.id, cur.midi), correct, Date.now() - askedAt.current);
      setScore((s) => ({
        ok: s.ok + (correct ? 1 : 0),
        total: s.total + 1,
        streak: correct ? s.streak + 1 : 0,
      }));
      if (correct) setTimeout(() => next(), 900);
    },
    [next],
  );

  // mic input → answer by pitch class
  useEffect(() => {
    if (inputMode !== "mic") {
      micRef.current?.stop();
      micRef.current = null;
      setMic("idle");
      return;
    }
    let live = true;
    void startMic(
      (midi) => {
        if (!live) return;
        const letter = midiToNote(midi).name[0] as Letter;
        // only fire if it's a clean natural-letter match candidate
        if (LETTERS.includes(letter)) answer(letter);
      },
      setMic,
    ).then((h) => {
      if (!h) return;
      if (live) micRef.current = h;
      else h.stop(); // effect was torn down before the mic finished opening
    });
    return () => {
      live = false;
      micRef.current?.stop();
      micRef.current = null;
    };
  }, [inputMode, answer]);

  // computer-key answers (a..g) when in buttons mode
  useEffect(() => {
    if (inputMode === "mic") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (resolvedRef.current && (k === " " || k === "enter")) {
        e.preventDefault();
        next();
        return;
      }
      const up = k.toUpperCase();
      if (inputMode === "buttons" && (LETTERS as readonly string[]).includes(up)) {
        answer(up as Letter);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputMode, answer, next]);

  const correctLetter = q.answer;
  const correctSpelling = spellInKey(q.midi, q.key);
  const revealLabel =
    nameMode === "solfege"
      ? `${letterLabel(correctSpelling.letter, "solfege")}${correctSpelling.accidental > 0 ? "♯" : correctSpelling.accidental < 0 ? "♭" : ""}${correctSpelling.octave}`
      : `${correctSpelling.letter}${correctSpelling.accidental > 0 ? "♯" : correctSpelling.accidental < 0 ? "♭" : ""}${correctSpelling.octave}`;

  return (
    <div className="animate-riseIn space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("nommer la note", "name the note")}</Label>
          <div className="font-serif text-xl text-ink">
            {q.clef.id === "treble" ? t("Clé de sol", "Treble clef") : q.clef.id === "bass" ? t("Clé de fa", "Bass clef") : t("Clé d'ut", "Alto clef")}
            {q.key.id !== "C" && <span className="text-ink-faint"> · {t(q.key.fr, q.key.en)}</span>}
          </div>
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

      {/* the sheet of staff paper */}
      <Card className="px-3 py-4 sm:px-6">
        <Staff
          clef={q.clef}
          keySig={q.key}
          notes={[{ midi: q.midi, duration: "q", state: result === "correct" ? "correct" : result === "wrong" ? "wrong" : "default" }]}
          width={520}
          barline={false}
        />
      </Card>

      {/* reveal banner */}
      {result && (
        <div className="animate-pop">
          <Card
            className={`px-4 py-3 text-center ${result === "correct" ? "ring-1 ring-sage/40" : "ring-1 ring-terracotta/40"}`}
          >
            <div className="font-serif text-lg" style={{ color: result === "correct" ? "#46715a" : "#bb5a3c" }}>
              {result === "correct" ? t("Juste ✓", "Correct ✓") : t("C'était ", "It was ")}
              {result === "wrong" && <span className="font-700">{revealLabel}</span>}
            </div>
            {result === "wrong" && (
              <Btn variant="bordeaux" className="mt-2" onClick={next}>
                {t("Note suivante →", "Next note →")}
              </Btn>
            )}
          </Card>
        </div>
      )}

      {/* input surfaces */}
      {inputMode === "buttons" && (
        <div className="grid grid-cols-7 gap-1.5">
          {letterOptions().map((letter) => {
            const isPicked = picked === letter;
            const showRight = result && letter === correctLetter;
            return (
              <button
                key={letter}
                type="button"
                disabled={!!result}
                onClick={() => answer(letter)}
                className={`key-press rounded-xl border py-3 font-serif text-lg font-600 transition-all disabled:opacity-60 ${
                  showRight
                    ? "border-sage bg-sage text-paper-card"
                    : isPicked
                      ? "border-terracotta bg-terracotta text-paper-card"
                      : "border-paper-edge bg-paper-card text-ink hover:border-bordeaux/40 hover:bg-paper-deep"
                }`}
              >
                {letterLabel(letter, nameMode)}
              </button>
            );
          })}
        </div>
      )}

      {inputMode === "piano" && (
        <Card className="p-3">
          <Piano
            low={q.clef.rangeLow}
            high={q.clef.rangeHigh + 2}
            highlight={result === "wrong" ? [q.midi] : []}
            correct={result === "correct" ? [q.midi] : []}
            labelMode={nameMode === "solfege" ? "solfege" : "letters"}
            disabled={!!result}
            onNote={(m) => {
              const letter = midiToNote(m).name[0] as Letter;
              answer(letter);
            }}
          />
          <p className="mt-2 text-center text-xs text-ink-faint">
            {t("Joue la touche dont c'est le nom (l'octave n'a pas d'importance).", "Play the key whose name it is (octave doesn't matter).")}
          </p>
        </Card>
      )}

      {inputMode === "mic" && (
        <Card className="px-4 py-4 text-center">
          {mic === "listening" ? (
            <p className="text-sm text-ink-soft">
              <span className="mr-2 inline-block h-2 w-2 animate-quill rounded-full bg-sage align-middle" />
              {t("J'écoute — chante ou joue la note.", "Listening — sing or play the note.")}
            </p>
          ) : mic === "requesting" ? (
            <p className="text-sm text-ink-faint">{t("Autorisation du micro…", "Requesting mic…")}</p>
          ) : mic === "denied" ? (
            <p className="text-sm text-terracotta">
              {t("Micro refusé. Repasse aux boutons ou au piano dans les réglages d'entrée.", "Mic denied. Switch back to buttons or piano in the input settings.")}
            </p>
          ) : mic === "unsupported" ? (
            <p className="text-sm text-terracotta">
              {t("Ce navigateur ne donne pas le micro — Chrome le supporte le mieux.", "This browser won't grant the mic — Chrome supports it best.")}
            </p>
          ) : (
            <p className="text-sm text-ink-faint">{t("Préparation du micro…", "Preparing the mic…")}</p>
          )}
        </Card>
      )}

      <div className="flex justify-center gap-2">
        <Btn
          variant="ghost"
          onClick={async () => {
            await unlockAudio();
            playNote(q.midi, 1.4);
          }}
        >
          {t("▶ Entendre", "▶ Hear it")}
        </Btn>
        {!result && (
          <Btn variant="ghost" onClick={next}>
            {t("Passer", "Skip")}
          </Btn>
        )}
      </div>
    </div>
  );
}
