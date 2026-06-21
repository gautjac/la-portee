import { useEffect, useMemo, useState } from "react";
import { useLang } from "./i18n";
import { Card, Label, Segmented } from "./components/ui";
import Onboarding from "./components/Onboarding";
import Progress from "./components/Progress";
import NoteDrill from "./drills/NoteDrill";
import KeyDrill from "./drills/KeyDrill";
import RhythmDrill from "./drills/RhythmDrill";
import SightDrill from "./drills/SightDrill";
import { LEVELS, levelById } from "./lib/curriculum";
import type { NoteNameMode } from "./lib/drills";
import { getSetting, setSetting, resetProgress } from "./lib/db";
import { setReverb, isReverbOn, unlockAudio } from "./lib/audio";
import { dateSeed, seededRandom } from "./lib/music";
import { makeNoteQuestion } from "./lib/drills";
import { localDay } from "./lib/db";

type Tab = "note" | "key" | "rhythm" | "sight" | "progress";
type InputMode = "buttons" | "piano" | "mic";

const NAME_KEY = "la-portee:nameMode"; // letters vs solfège — its own setting

export default function App() {
  const { t, lang, setLang } = useLang();
  const [onboard, setOnboard] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("note");
  const [level, setLevel] = useState(1);
  const [nameMode, setNameMode] = useState<NoteNameMode>("solfege");
  const [inputMode, setInputMode] = useState<InputMode>("buttons");
  const [sightMic, setSightMic] = useState(false);
  const [reverb, setReverbState] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // load persisted settings (fresh IndexedDB → defaults)
  useEffect(() => {
    (async () => {
      const seen = await getSetting<boolean>("onboarded", false);
      setOnboard(!seen);
      setLevel(await getSetting<number>("level", 1));
      const savedName = localStorage.getItem(NAME_KEY);
      setNameMode(savedName === "letters" ? "letters" : "solfege");
      setInputMode(await getSetting<InputMode>("inputMode", "buttons"));
      const rev = await getSetting<boolean>("reverb", true);
      setReverbState(rev);
      setReverb(rev);
      setReady(true);
    })();
  }, []);

  const finishOnboarding = async () => {
    setOnboard(false);
    await setSetting("onboarded", true);
  };

  const changeLevel = async (l: number) => {
    setLevel(l);
    await setSetting("level", l);
  };
  const changeName = (m: NoteNameMode) => {
    setNameMode(m);
    localStorage.setItem(NAME_KEY, m);
  };
  const changeInput = async (m: InputMode) => {
    setInputMode(m);
    await setSetting("inputMode", m);
    if (m === "piano" || m === "mic") void unlockAudio();
  };
  const toggleReverb = async () => {
    const v = !reverb;
    setReverbState(v);
    setReverb(v);
    isReverbOn();
    await setSetting("reverb", v);
  };

  // exercice du jour — a deterministic preview note for today
  const daily = useMemo(() => {
    const rng = seededRandom(dateSeed(localDay()));
    const lvl = levelById(Math.min(level, 3) >= 1 ? level : 1);
    return makeNoteQuestion(lvl, rng);
  }, [level]);

  const lvl = levelById(level);

  if (!ready) {
    return (
      <div className="desk grain flex min-h-screen items-center justify-center">
        <div className="font-display text-6xl text-bordeaux/40 animate-quill">𝄞</div>
      </div>
    );
  }

  const TABS: { id: Tab; fr: string; en: string; glyph: string }[] = [
    { id: "note", fr: "Notes", en: "Notes", glyph: "𝄞" },
    { id: "key", fr: "Armures", en: "Keys", glyph: "♯" },
    { id: "rhythm", fr: "Rythme", en: "Rhythm", glyph: "♪" },
    { id: "sight", fr: "Déchiffrage", en: "Sight", glyph: "𝄢" },
    { id: "progress", fr: "Progrès", en: "Progress", glyph: "✦" },
  ];

  return (
    <div className="desk grain relative min-h-screen">
      {onboard && <Onboarding onDone={finishOnboarding} />}

      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-6 sm:pt-9">
        {/* header */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-4xl leading-none text-bordeaux gilt">𝄞</span>
              <div>
                <h1 className="font-display text-3xl font-700 leading-none tracking-tight text-ink gilt sm:text-4xl">
                  La Portée
                </h1>
                <p className="font-serif text-xs italic text-ink-faint">
                  {t("l'atelier de lecture musicale", "the music-reading studio")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-paper-edge text-xs">
              <button
                onClick={() => setLang("fr")}
                className={`px-2 py-1 font-600 ${lang === "fr" ? "bg-ink text-paper-card" : "text-ink-faint"}`}
              >
                FR
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 font-600 ${lang === "en" ? "bg-ink text-paper-card" : "text-ink-faint"}`}
              >
                EN
              </button>
            </div>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="key-press rounded-lg border border-paper-edge bg-paper-card px-2.5 py-1.5 text-ink-faint hover:text-ink"
              aria-label={t("Réglages", "Settings")}
            >
              ⚙
            </button>
          </div>
        </header>

        {/* settings drawer */}
        {settingsOpen && (
          <Card className="mb-5 animate-riseIn space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t("noms de notes", "note names")}</Label>
              <Segmented<NoteNameMode>
                value={nameMode}
                onChange={changeName}
                size="sm"
                options={[
                  { id: "solfege", label: "Do Ré Mi" },
                  { id: "letters", label: "C D E" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t("entrée des notes", "note input")}</Label>
              <Segmented<InputMode>
                value={inputMode}
                onChange={changeInput}
                size="sm"
                options={[
                  { id: "buttons", label: t("Boutons", "Buttons") },
                  { id: "piano", label: "Piano" },
                  { id: "mic", label: t("Micro", "Mic") },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label>{t("réverbération", "reverb")}</Label>
              <button
                onClick={toggleReverb}
                className={`relative h-6 w-11 rounded-full transition-colors ${reverb ? "bg-sage" : "bg-paper-edge"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-card shadow transition-all ${reverb ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </div>
            <div className="border-t border-paper-edge pt-3">
              <button
                onClick={async () => {
                  if (confirm(t("Effacer toute la progression ?", "Erase all progress?"))) {
                    await resetProgress();
                  }
                }}
                className="font-sans text-xs text-terracotta hover:underline"
              >
                {t("Réinitialiser la progression", "Reset progress")}
              </button>
              <button
                onClick={() => setOnboard(true)}
                className="ml-4 font-sans text-xs text-ink-faint hover:underline"
              >
                {t("Revoir l'intro", "Replay intro")}
              </button>
            </div>
          </Card>
        )}

        {/* level selector */}
        <Card className="mb-5 p-4">
          <div className="flex items-center justify-between">
            <Label>{t("niveau", "level")}</Label>
            <span className="font-mono text-[10px] text-ink-ghost">
              {level}/{LEVELS.length}
            </span>
          </div>
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => changeLevel(l.id)}
                className={`key-press shrink-0 rounded-lg border px-3 py-1.5 font-sans text-xs font-600 transition-all ${
                  level === l.id
                    ? "border-bordeaux bg-bordeaux text-paper-card"
                    : "border-paper-edge bg-paper-card text-ink-faint hover:text-ink"
                }`}
              >
                {l.id}. {t(l.fr, l.en)}
              </button>
            ))}
          </div>
          <p className="mt-2 font-serif text-sm italic text-ink-soft">{t(lvl.descFr, lvl.descEn)}</p>
        </Card>

        {/* exercice du jour ribbon */}
        {tab === "note" && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5">
            <span className="font-display text-2xl text-gold">✶</span>
            <div className="text-sm">
              <span className="font-600 text-ink">{t("Exercice du jour", "Today's exercise")}</span>
              <span className="text-ink-faint">
                {" "}
                — {t("clé", "clef")} {daily.clef.id === "treble" ? t("de sol", "treble") : daily.clef.id === "bass" ? t("de fa", "bass") : t("d'ut", "alto")}
                {daily.key.id !== "C" && `, ${t(daily.key.fr, daily.key.en)}`}
              </span>
            </div>
          </div>
        )}

        {/* drill area */}
        <main>
          {tab === "note" && <NoteDrill level={level} nameMode={nameMode} inputMode={inputMode} />}
          {tab === "key" && <KeyDrill level={level} />}
          {tab === "rhythm" && <RhythmDrill level={level} />}
          {tab === "sight" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-paper-edge bg-paper-card/60 px-3 py-2">
                <Label>{t("scorer au micro", "score with mic")}</Label>
                <button
                  onClick={() => setSightMic((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${sightMic ? "bg-sage" : "bg-paper-edge"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-card shadow transition-all ${sightMic ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <SightDrill level={level} useMic={sightMic} />
            </div>
          )}
          {tab === "progress" && <Progress level={level} />}
        </main>
      </div>

      {/* bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-paper-edge bg-paper-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                tab === tb.id ? "text-bordeaux" : "text-ink-ghost hover:text-ink-faint"
              }`}
            >
              <span className="font-display text-xl leading-none">{tb.glyph}</span>
              <span className="font-sans text-[10px] font-600">{t(tb.fr, tb.en)}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
