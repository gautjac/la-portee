import { useState } from "react";
import { Btn } from "./ui";
import { useLang } from "../i18n";

const STEPS = [
  {
    glyph: "𝄞",
    fr: { title: "Lire la portée", body: "La Portée t'apprend à lire la notation musicale en temps réel : les notes sur les lignes, les armures, le rythme, et le déchiffrage défilant." },
    en: { title: "Read the staff", body: "La Portée teaches you to read music notation in real time: notes on the lines, key signatures, rhythm, and scrolling sight-reading." },
  },
  {
    glyph: "♯",
    fr: { title: "Tu choisis l'entrée", body: "Réponds aux boutons, au piano à l'écran, au clavier d'ordi, au micro (chante la note !) ou en MIDI. Le piano marche toujours." },
    en: { title: "You pick the input", body: "Answer with buttons, the on-screen piano, your computer keys, the mic (sing the note!) or MIDI. The piano always works." },
  },
  {
    glyph: "♪",
    fr: { title: "Ça s'adapte à toi", body: "Les notes et tonalités que tu rates reviennent plus souvent. Un échelon de niveaux te mène du Mi-Sol-Si-Ré-Fa jusqu'à la grande portée." },
    en: { title: "It adapts to you", body: "The notes and keys you miss come back more often. A level ladder takes you from E-G-B-D-F all the way to the grand staff." },
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { t, lang, setLang } = useLang();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md rounded-3xl p-7 text-center shadow-sheet">
        <div className="mb-3 flex justify-center gap-1">
          {STEPS.map((_, j) => (
            <span
              key={j}
              className={`h-1.5 rounded-full transition-all ${j === i ? "w-7 bg-bordeaux" : "w-1.5 bg-paper-edge"}`}
            />
          ))}
        </div>

        <div className="my-4 font-display text-7xl text-bordeaux gilt">{step.glyph}</div>
        <h2 className="font-serif text-2xl font-600 text-ink">{t(step.fr.title, step.en.title)}</h2>
        <p className="mx-auto mt-2 max-w-sm font-serif text-[15px] leading-relaxed text-ink-soft">
          {t(step.fr.body, step.en.body)}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            className="font-sans text-sm text-ink-faint hover:text-ink"
          >
            {t("Passer", "Skip")}
          </button>
          <div className="flex items-center gap-2">
            <div className="mr-1 inline-flex overflow-hidden rounded-lg border border-paper-edge text-xs">
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
            <Btn variant="bordeaux" onClick={() => (last ? onDone() : setI(i + 1))}>
              {last ? t("Commencer", "Begin") : t("Suivant", "Next")}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
