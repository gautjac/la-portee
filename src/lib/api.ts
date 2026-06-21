import { localTip, type WeakSpot } from "./tips";
import type { Lang } from "../i18n";

export interface TipRequest {
  weak: WeakSpot[];
  /** current daily streak, for flavour. */
  streak: number;
  /** highest level reached, for context. */
  level: number;
  lang: Lang;
}

/**
 * Fetch a sight-reading "conseil" from the optional Claude function.
 * The engine streams NDJSON (keepalive heartbeats + a final {result|error}
 * line). If anything fails or we're offline, fall back to the local tip bank
 * so the feature always works.
 */
export async function fetchTip(
  req: TipRequest,
): Promise<{ tip: string; source: "claude" | "local" }> {
  try {
    const res = await fetch("/api/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });

    const raw = await res.text();
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] ?? "";

    let parsed: { result?: string; error?: string } | null = null;
    try {
      parsed = last ? JSON.parse(last) : null;
    } catch {
      parsed = null;
    }

    if (res.ok && parsed && parsed.result && parsed.result.trim()) {
      return { tip: parsed.result.trim(), source: "claude" };
    }
  } catch {
    /* offline or function unavailable — fall through to local */
  }
  return { tip: localTip(req.weak, req.lang), source: "local" };
}
