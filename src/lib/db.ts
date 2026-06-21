// ─────────────────────────────────────────────────────────────────────────
// La Portée — local persistence (Dexie / IndexedDB).
// Per-item Leitner SRS for the notes / keys / rhythms a reader keeps missing,
// attempt history, daily roll-ups (streak + 14-day chart), and settings.
// Everything stays on the device. First run is empty: .get() → undefined, so
// every read coalesces to a safe default (?? …).
// ─────────────────────────────────────────────────────────────────────────

import Dexie, { type Table } from "dexie";

export type DrillKind = "note" | "key" | "rhythm" | "sight";

/** One trainable item, e.g. note "treble:G4", key "Eb", rhythm "q-q-h". */
export interface SrsItem {
  key: string; // composite, e.g. "note:treble:G4"
  kind: DrillKind;
  itemId: string;
  box: number; // Leitner 0..4
  attempts: number;
  correct: number;
  streak: number;
  due: number; // ms
  lastSeen: number; // ms
}

export interface Attempt {
  id?: number;
  kind: DrillKind;
  itemId: string;
  correct: boolean;
  ms: number; // response time
  ts: number;
}

export interface DayStat {
  day: string; // YYYY-MM-DD
  attempts: number;
  correct: number;
  seconds: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

class PorteeDB extends Dexie {
  items!: Table<SrsItem, string>;
  attempts!: Table<Attempt, number>;
  days!: Table<DayStat, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("la-portee");
    this.version(1).stores({
      items: "key, kind, due, box",
      attempts: "++id, kind, ts",
      days: "day",
      settings: "key",
    });
  }
}

export const db = new PorteeDB();

const BOX_SPACING_MS = [
  0,
  1000 * 60 * 5,
  1000 * 60 * 60 * 8,
  1000 * 60 * 60 * 24 * 2,
  1000 * 60 * 60 * 24 * 6,
];

export function itemKey(kind: DrillKind, itemId: string): string {
  return `${kind}:${itemId}`;
}

export async function recordAttempt(
  kind: DrillKind,
  itemId: string,
  correct: boolean,
  ms: number,
): Promise<void> {
  const now = Date.now();
  const key = itemKey(kind, itemId);

  await db.transaction("rw", db.items, db.attempts, db.days, async () => {
    const existing = (await db.items.get(key)) ?? null;
    const base: SrsItem =
      existing ?? {
        key,
        kind,
        itemId,
        box: 0,
        attempts: 0,
        correct: 0,
        streak: 0,
        due: now,
        lastSeen: now,
      };

    base.attempts += 1;
    if (correct) {
      base.correct += 1;
      base.streak += 1;
      base.box = Math.min(4, base.box + 1);
    } else {
      base.streak = 0;
      base.box = Math.max(0, base.box - 1);
    }
    base.lastSeen = now;
    base.due = now + BOX_SPACING_MS[base.box];
    await db.items.put(base);

    await db.attempts.add({ kind, itemId, correct, ms, ts: now });

    const day = localDay(now);
    const ds = (await db.days.get(day)) ?? { day, attempts: 0, correct: 0, seconds: 0 };
    ds.attempts += 1;
    if (correct) ds.correct += 1;
    ds.seconds += Math.min(20, Math.round(ms / 1000));
    await db.days.put(ds);
  });
}

/** Local-time YYYY-MM-DD (so streaks line up with the user's day). */
export function localDay(ms = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Weighted pick biased toward weak / due items. Unseen items get high priority
 * so the whole pool gets covered before the SRS settles.
 */
export async function pickWeighted(kind: DrillKind, candidates: string[]): Promise<string> {
  if (candidates.length === 0) return "";
  const now = Date.now();
  const rows = await db.items.where("kind").equals(kind).toArray();
  const byId = new Map(rows.map((r) => [r.itemId, r]));

  const weights = candidates.map((id) => {
    const it = byId.get(id);
    if (!it) return 6; // never seen → high priority
    const accuracy = it.attempts > 0 ? it.correct / it.attempts : 0.5;
    let w = 1 + (1 - accuracy) * 5;
    if (it.due <= now) w += 3;
    return Math.max(0.4, w);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = (await db.settings.get(key)) ?? null;
  return row ? (row.value as T) : fallback;
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Daily streak (consecutive local days with ≥1 attempt; today may be empty). */
export function computeStreak(days: DayStat[]): number {
  const set = new Set(days.filter((d) => d.attempts > 0).map((d) => d.day));
  let streak = 0;
  const cursor = new Date();
  const today = localDay(cursor.getTime());
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = localDay(cursor.getTime());
    if (set.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

/** Last N days of stats (oldest→newest), filling gaps with zeros. */
export function last14(days: DayStat[], n = 14): DayStat[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: DayStat[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = localDay(cursor.getTime());
    out.push(byDay.get(key) ?? { day: key, attempts: 0, correct: 0, seconds: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function resetProgress(): Promise<void> {
  await db.transaction("rw", db.items, db.attempts, db.days, async () => {
    await db.items.clear();
    await db.attempts.clear();
    await db.days.clear();
  });
}
