import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Btn, Card, Label } from "../components/ui";
import { useLang } from "../i18n";
import { db, computeStreak, last14, type SrsItem, type DayStat } from "../lib/db";
import { fetchTip } from "../lib/api";
import type { WeakSpot } from "../lib/tips";
import {
  CLEFS,
  KEY_BY_ID,
  midiToNote,
} from "../lib/music";

const KIND_LABEL: Record<string, { fr: string; en: string }> = {
  note: { fr: "Notes", en: "Notes" },
  key: { fr: "Armures", en: "Key sigs" },
  rhythm: { fr: "Rythme", en: "Rhythm" },
  sight: { fr: "Déchiffrage", en: "Sight-reading" },
};

/** Human label for an SRS item id, per kind. */
function itemLabel(it: SrsItem): string {
  if (it.kind === "note") {
    const [clef, midiStr] = it.itemId.split(":");
    const midi = parseInt(midiStr, 10);
    const c = CLEFS[clef as "treble" | "bass" | "alto"];
    return `${midiToNote(midi).name}${midiToNote(midi).octave} · ${c ? c.id : clef}`;
  }
  if (it.kind === "key") {
    return KEY_BY_ID[it.itemId]?.fr ?? it.itemId;
  }
  return it.itemId;
}

export default function Progress({ level }: { level: number }) {
  const { t, lang } = useLang();
  const days = useLiveQuery(() => db.days.toArray(), [], [] as DayStat[]);
  const items = useLiveQuery(() => db.items.toArray(), [], [] as SrsItem[]);

  const streak = useMemo(() => computeStreak(days ?? []), [days]);
  const chart = useMemo(() => last14(days ?? []), [days]);

  const totals = useMemo(() => {
    const all = days ?? [];
    const attempts = all.reduce((s, d) => s + d.attempts, 0);
    const correct = all.reduce((s, d) => s + d.correct, 0);
    return { attempts, correct, acc: attempts > 0 ? correct / attempts : 0 };
  }, [days]);

  // weak spots: items with the lowest accuracy (≥2 attempts)
  const weak = useMemo<WeakSpot[]>(() => {
    return (items ?? [])
      .filter((it) => it.attempts >= 2)
      .map((it) => ({
        kind: it.kind,
        label: itemLabel(it),
        accuracy: it.correct / it.attempts,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10);
  }, [items]);

  const [tip, setTip] = useState<string>("");
  const [tipSource, setTipSource] = useState<"claude" | "local" | "">("");
  const [tipLoading, setTipLoading] = useState(false);

  const getTip = async () => {
    setTipLoading(true);
    const r = await fetchTip({ weak, streak, level, lang });
    setTip(r.tip);
    setTipSource(r.source);
    setTipLoading(false);
  };

  useEffect(() => {
    setTip("");
    setTipSource("");
  }, [lang]);

  const maxAttempts = Math.max(1, ...chart.map((d) => d.attempts));

  return (
    <div className="animate-riseIn space-y-5">
      {/* headline stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("série", "streak")} value={`${streak}`} sub={t("jours", "days")} accent="bordeaux" />
        <Stat
          label={t("justesse", "accuracy")}
          value={totals.attempts > 0 ? `${Math.round(totals.acc * 100)}%` : "—"}
          sub={t("globale", "overall")}
          accent="sage"
        />
        <Stat label={t("lectures", "reads")} value={`${totals.attempts}`} sub={t("au total", "total")} accent="gold" />
      </div>

      {/* 14-day chart */}
      <Card className="p-4">
        <Label>{t("14 derniers jours", "last 14 days")}</Label>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {chart.map((d) => {
            const h = (d.attempts / maxAttempts) * 100;
            const acc = d.attempts > 0 ? d.correct / d.attempts : 0;
            const color = d.attempts === 0 ? "#e4d8be" : acc >= 0.8 ? "#46715a" : acc >= 0.5 ? "#b8893a" : "#bb5a3c";
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day} · ${d.correct}/${d.attempts}`}>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[3px] transition-all"
                    style={{ height: `${Math.max(d.attempts > 0 ? 8 : 3, h)}%`, background: color }}
                  />
                </div>
                <div className="font-mono text-[8px] text-ink-ghost">{d.day.slice(8)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* weakness heatmap */}
      <Card className="p-4">
        <Label>{t("points faibles", "weak spots")}</Label>
        {weak.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">
            {t("Rien de marqué encore — joue quelques rondes pour voir où ça coince.", "Nothing flagged yet — play a few rounds to see where it sticks.")}
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {weak.slice(0, 8).map((w, i) => {
              const pct = Math.round(w.accuracy * 100);
              const color = w.accuracy >= 0.8 ? "#46715a" : w.accuracy >= 0.5 ? "#b8893a" : "#bb5a3c";
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-ghost">
                    {t(KIND_LABEL[w.kind]?.fr ?? w.kind, KIND_LABEL[w.kind]?.en ?? w.kind)}
                  </span>
                  <span className="w-28 shrink-0 truncate font-serif text-sm text-ink">{w.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono tnum text-xs text-ink-faint">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* conseil du jour */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Label>{t("conseil du jour", "today's tip")}</Label>
          {tipSource && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-ghost">
              {tipSource === "claude" ? t("rédigé pour toi", "written for you") : t("hors-ligne", "offline")}
            </span>
          )}
        </div>
        {tip ? (
          <p className="mt-2 font-serif text-[15px] leading-relaxed text-ink-soft">{tip}</p>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">
            {t("Demande un conseil de lecture ciblé sur tes points faibles.", "Ask for a reading tip tuned to your weak spots.")}
          </p>
        )}
        <Btn variant="bordeaux" className="mt-3" onClick={getTip} disabled={tipLoading}>
          {tipLoading ? (
            <>
              <span className="inline-block h-1.5 w-1.5 animate-quill rounded-full bg-paper-card" />
              {t("Rédaction…", "Writing…")}
            </>
          ) : tip ? (
            t("Un autre conseil", "Another tip")
          ) : (
            t("Donne-moi un conseil", "Give me a tip")
          )}
        </Btn>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "bordeaux" | "sage" | "gold";
}) {
  const color = accent === "bordeaux" ? "#7a2230" : accent === "sage" ? "#46715a" : "#b8893a";
  return (
    <Card className="px-3 py-3 text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">{label}</div>
      <div className="font-serif text-3xl font-600 tnum" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[9px] text-ink-ghost">{sub}</div>
    </Card>
  );
}
