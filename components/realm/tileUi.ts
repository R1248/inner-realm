import type { Tile } from "../../lib/types";

export const MAX_LEVEL = 3;
export const BASE_MIN = 60;

// If you already have region multipliers in store, keep these in sync.
export const REGION_MULT: Record<Tile["region"], number> = {
  wastelands: 0.75,
  river: 1.0,
  citadel: 1.5,
};

export function segmentNeed(level: number, region: Tile["region"]) {
  const mult = REGION_MULT[region] ?? 1;
  return Math.max(1, Math.round(BASE_MIN * (level + 1) * mult));
}

export function totalRequiredForLevel(level: number, region: Tile["region"]) {
  let total = 0;
  for (let i = 0; i < level; i++) total += segmentNeed(i, region);
  return total;
}

export function regionColors(region: Tile["region"]) {
  switch (region) {
    case "citadel":
      return { border: "#38bdf8", fill: "#38bdf8" };
    case "river":
      return { border: "#a78bfa", fill: "#a78bfa" };
    case "wastelands":
    default:
      return { border: "#f59e0b", fill: "#f59e0b" };
  }
}

export function levelBg(region: Tile["region"], level: number) {
  const L = Math.max(0, Math.min(MAX_LEVEL, level));
  if (L === 0) return "#050608";
  if (region === "citadel") return ["#0b1220", "#0b1f34", "#0c2f4f"][L - 1];
  if (region === "river") return ["#150b24", "#24104a", "#35106b"][L - 1];
  return ["#1a1206", "#2a1a07", "#3a2408"][L - 1];
}

export function tileProgressRatio(t: Tile) {
  const level = Math.max(0, Math.min(MAX_LEVEL, t.level));
  const isMax = level >= MAX_LEVEL;
  if (isMax) return 1;

  const start = totalRequiredForLevel(level, t.region);
  const need = segmentNeed(level, t.region);
  const within = Math.max(0, (t.progress ?? 0) - start);
  return Math.max(0, Math.min(1, within / Math.max(1, need)));
}
