import type { Context } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

type Lang = "fr" | "en";
interface WeakSpot {
  kind: string;
  label: string;
  accuracy: number;
}
interface TipRequest {
  weak: WeakSpot[];
  streak: number;
  level: number;
  lang: Lang;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function client(): Anthropic {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("Server missing CLAUDE_API_KEY");
  return new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });
}

async function makeTip(req: TipRequest): Promise<string> {
  const fr = req.lang !== "en";

  const weakLines =
    req.weak.length > 0
      ? req.weak
          .slice(0, 6)
          .map((w) =>
            fr
              ? `- ${w.label} (${w.kind}) : ${Math.round(w.accuracy * 100)} % de réussite`
              : `- ${w.label} (${w.kind}): ${Math.round(w.accuracy * 100)}% success rate`,
          )
          .join("\n")
      : fr
        ? "- (pas encore assez de données)"
        : "- (not enough data yet)";

  const sys = fr
    ? "Tu es un professeur de lecture musicale (déchiffrage / lecture de la portée) chaleureux et précis, " +
      "qui s'adresse à un musicien québécois. Tu écris en français québécois naturel, tutoiement. " +
      "Tu donnes UN seul conseil de lecture concret, actionnable et encourageant, ciblé sur le point faible " +
      "le plus marqué (noms de notes sur la portée, armures, rythme, ou déchiffrage défilant). " +
      "Deux à trois phrases maximum. Pas de liste, pas de préambule, pas de guillemets. " +
      "Tu peux donner un truc mnémotechnique, un repère visuel sur la portée, ou une stratégie de l'œil. " +
      "Utilise les conventions (clé de sol/fa, lignes/interlignes, dièses/bémols, noms de notes Do–Si ou C–B)."
    : "You are a warm, precise sight-reading teacher (reading standard notation on the staff) speaking to a " +
      "musician. You write in natural English, addressing the learner directly. You give ONE single concrete, " +
      "actionable, encouraging reading tip, focused on the most pronounced weak spot (note names on the staff, " +
      "key signatures, rhythm, or scrolling sight-reading). Two to three sentences maximum. No lists, no preamble, " +
      "no quotation marks. You may offer a mnemonic, a visual landmark on the staff, or an eye-movement strategy. " +
      "Use standard conventions (treble/bass clef, lines/spaces, sharps/flats, note names C–B).";

  const user = fr
    ? `Voici les points faibles actuels du lecteur (du plus faible au moins) :\n${weakLines}\n\n` +
      `Niveau atteint : ${req.level}. Série de jours consécutifs : ${req.streak}.\n\n` +
      `Donne-lui un conseil de lecture ciblé.`
    : `Here are the reader's current weak spots (weakest first):\n${weakLines}\n\n` +
      `Level reached: ${req.level}. Consecutive-day streak: ${req.streak}.\n\n` +
      `Give them one targeted sight-reading tip.`;

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 320,
    system: sys,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error(fr ? "Réponse vide" : "Empty response");
  return text;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: TipRequest;
  try {
    body = (await req.json()) as TipRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!Array.isArray(body.weak)) body.weak = [];
  if (typeof body.streak !== "number") body.streak = 0;
  if (typeof body.level !== "number") body.level = 1;
  body.lang = body.lang === "en" ? "en" : "fr";

  // The Opus call can exceed the synchronous proxy idle timeout. Stream NDJSON:
  // a bare-newline heartbeat every 3s keeps the connection alive, then a final
  // {result|error} line carries the payload. The client reads to end-of-stream
  // and parses the last JSON line.
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = false;
      const beat = setInterval(() => {
        if (!done) {
          try {
            controller.enqueue(enc.encode("\n"));
          } catch {
            /* closed */
          }
        }
      }, 3000);

      try {
        const result = await makeTip(body);
        done = true;
        clearInterval(beat);
        controller.enqueue(enc.encode(JSON.stringify({ result }) + "\n"));
      } catch (err) {
        done = true;
        clearInterval(beat);
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        controller.enqueue(enc.encode(JSON.stringify({ error: message }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
};
