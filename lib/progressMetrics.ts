import type { ActivityType, Session } from "./types";

export type DisplayActivity = "work" | "study" | "meditation" | "sport";
export type DayAgg = Record<DisplayActivity, number> & { total: number };

export function toDisplayActivity(activity: ActivityType): DisplayActivity | null {
  if (activity === "mindfulness" || activity === "meditation") return "meditation";
  if (activity === "work" || activity === "study" || activity === "sport") return activity;
  return null;
}

export function emptyDayAgg(): DayAgg {
  return { work: 0, study: 0, meditation: 0, sport: 0, total: 0 };
}

export function dayKeyLocal(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function makeLastNDaysKeys(n: number) {
  const out: string[] = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (let i = 0; i < n; i++) {
    const t = base - i * 24 * 60 * 60 * 1000;
    out.push(dayKeyLocal(t));
  }
  return out; // [today..older]
}

export function formatDayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} ${d}.${m}.`;
}

export function buildDayAggMap(sessions: Session[], dayKeys: string[]): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  for (const k of dayKeys) map.set(k, emptyDayAgg());

  for (const s of sessions) {
    const k = dayKeyLocal(s.createdAt);
    if (!map.has(k)) continue;
    const agg = map.get(k)!;
    const display = toDisplayActivity(s.activity);
    if (!display) continue;
    const mins = Number(s.minutes) || 0;
    agg[display] += mins;
    agg.total += mins;
  }

  return map;
}

export function sumForActivity(
  map: Map<string, DayAgg>,
  dayKeys: string[],
  activity: DisplayActivity | "total",
): number {
  let total = 0;
  for (const key of dayKeys) {
    const agg = map.get(key);
    if (!agg) continue;
    total += activity === "total" ? agg.total : agg[activity];
  }
  return total;
}

export function streakForActivity(
  map: Map<string, DayAgg>,
  dayKeys: string[],
  activity: DisplayActivity,
): number {
  let streak = 0;
  for (const key of dayKeys) {
    const agg = map.get(key);
    const value = agg ? agg[activity] : 0;
    if (value > 0) streak += 1;
    else break;
  }
  return streak;
}

export function trendForActivity(
  map: Map<string, DayAgg>,
  dayKeys: string[],
  activity: DisplayActivity,
): "up" | "down" | "flat" {
  const recent = dayKeys.slice(0, 7);
  const prev = dayKeys.slice(7, 14);

  const sumRecent = sumForActivity(map, recent, activity);
  const sumPrev = sumForActivity(map, prev, activity);

  if (sumPrev <= 0) {
    return sumRecent > 0 ? "up" : "flat";
  }

  const delta = (sumRecent - sumPrev) / sumPrev;
  if (delta > 0.1) return "up";
  if (delta < -0.1) return "down";
  return "flat";
}
