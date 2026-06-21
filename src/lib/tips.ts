// ─────────────────────────────────────────────────────────────────────────
// Local "conseil de lecture" tip bank — the offline fallback for /api/tip.
// Keyed by the reader's weakest area so even without the network the app
// gives a relevant, encouraging sight-reading coaching note, in FR or EN.
// ─────────────────────────────────────────────────────────────────────────

import type { Lang } from "../i18n";

export interface WeakSpot {
  kind: string; // "note" | "key" | "rhythm" | "sight"
  label: string;
  accuracy: number; // 0..1
}

const GENERIC_FR: string[] = [
  "Lis par intervalles, pas note à note : une fois la première note nommée, vois si la suivante monte ou descend, et de combien.",
  "Travaille court mais souvent : cinq minutes de déchiffrage par jour battent une heure le dimanche.",
  "Garde l'œil une note en avance sur ta main. Le bon lecteur lit toujours un peu devant.",
  "Ancre-toi sur les repères : en clé de sol, le Sol s'enroule autour de la 2e ligne ; en clé de fa, le Fa colle aux deux points.",
  "Chante le nom des notes à voix haute en lisant : la bouche fixe ce que l'œil survole.",
];

const GENERIC_EN: string[] = [
  "Read by interval, not note by note: once you've named the first note, see if the next goes up or down, and by how much.",
  "Practise short but often: five minutes of reading a day beats an hour on Sunday.",
  "Keep your eye one note ahead of your hand. A good reader always looks a little forward.",
  "Lean on the landmarks: in treble the G curls around the 2nd line; in bass the F hugs the two dots.",
  "Say the note names aloud as you read: the mouth pins down what the eye skims.",
];

const BY_KIND_FR: Record<string, string[]> = {
  note: [
    "Pour les lignes supplémentaires, compte par tierces depuis un repère sûr : do central, puis mi, sol, si en montant.",
    "Mémorise les acrostiches : « Mi Sol Si Ré Fa » pour les lignes de sol, « Fa La Do Mi » pour les interlignes.",
    "Ne déchiffre pas chaque note à froid : repère d'abord la note la plus grave et la plus aiguë, puis remplis entre les deux.",
    "Alterne clé de sol et clé de fa dans la même séance : ton cerveau apprend à changer de carte plus vite.",
  ],
  key: [
    "Compte les dièses : le dernier dièse est la sensible. Monte d'un demi-ton et tu as la tonique.",
    "Pour les bémols : l'avant-dernier bémol nomme la tonalité. Deux bémols ? L'avant-dernier est Si♭.",
    "Apprends l'ordre des dièses (Fa Do Sol Ré La Mi Si) et des bémols (l'inverse) : l'armure devient lisible d'un coup d'œil.",
    "Associe chaque armure à une chanson que tu connais dans cette tonalité — l'armure cesse d'être abstraite.",
  ],
  rhythm: [
    "Compte à voix haute « 1 et 2 et » : les croches tombent sur le « et », jamais entre.",
    "Tape le pouls d'un pied pendant que la main bat le rythme : un appui régulier rend le contretemps évident.",
    "Subdivise mentalement avant de commencer : sens les doubles-croches même quand tu joues des noires.",
    "Lis le rythme sans les hauteurs d'abord, puis rajoute les notes : sépare les deux difficultés.",
  ],
  sight: [
    "En déchiffrage, ne t'arrête JAMAIS : une fausse note se rattrape, un arrêt casse la pulsation.",
    "Avant de jouer, scanne la phrase : tonalité, mesure, note de départ, contour général. Dix secondes de repérage valent de l'or.",
    "Choisis un tempo où tu peux tenir la note la plus rapide. La régularité prime sur la vitesse.",
    "Garde les yeux qui défilent avec le curseur, pas qui sautent : le regard fluide nourrit un jeu fluide.",
  ],
};

const BY_KIND_EN: Record<string, string[]> = {
  note: [
    "For ledger lines, count in thirds from a sure landmark: middle C, then E, G, B going up.",
    "Memorise the mnemonics: \"Every Good Boy Does Fine\" for treble lines, \"FACE\" for the spaces.",
    "Don't decode every note cold: spot the lowest and highest note first, then fill in between.",
    "Alternate treble and bass clef in one session: your brain learns to switch maps faster.",
  ],
  key: [
    "Count the sharps: the last sharp is the leading tone. Go up a half-step and you have the tonic.",
    "For flats: the second-to-last flat names the key. Two flats? The next-to-last is B♭.",
    "Learn the order of sharps (F C G D A E B) and flats (the reverse): the signature reads at a glance.",
    "Tie each key signature to a song you know in that key — the signature stops being abstract.",
  ],
  rhythm: [
    "Count aloud \"1 and 2 and\": eighth notes land on the \"and\", never between.",
    "Tap the pulse with a foot while your hand claps the rhythm: a steady anchor makes the offbeat obvious.",
    "Subdivide in your head before you start: feel the sixteenths even when you're playing quarters.",
    "Read the rhythm without pitches first, then add the notes: split the two difficulties.",
  ],
  sight: [
    "When sight-reading, NEVER stop: a wrong note recovers, a stop breaks the pulse.",
    "Before you play, scan the phrase: key, time signature, starting note, overall shape. Ten seconds of recon is gold.",
    "Pick a tempo where you can hold the fastest note. Steadiness beats speed.",
    "Let your eyes glide with the cursor, not jump: a smooth gaze feeds smooth playing.",
  ],
};

export function localTip(weak: WeakSpot[], lang: Lang = "fr"): string {
  const fr = lang === "fr";
  const generic = fr ? GENERIC_FR : GENERIC_EN;
  const byKind = fr ? BY_KIND_FR : BY_KIND_EN;
  const worst = [...weak].sort((a, b) => a.accuracy - b.accuracy)[0];
  const pool = worst && byKind[worst.kind] ? byKind[worst.kind] : generic;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (worst && worst.accuracy < 0.95) {
    const pct = Math.round(worst.accuracy * 100);
    return fr
      ? `${worst.label} te résiste un peu (${pct} %). ${choice}`
      : `${worst.label} is giving you a bit of trouble (${pct}%). ${choice}`;
  }
  return choice;
}
