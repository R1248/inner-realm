import type { RegionType, Tile } from "../types";
import { regionDifficultyMult } from "./regions";

export const MAX_LEVEL = 3;
export const BASE_MIN = 60;

/**
 * Minutes needed for segment (level -> level+1). Thresholds are cumulative.
 * Region multiplier comes from the region registry.
 */
export function segmentNeed(level: number, region: RegionType): number {
  const mult = regionDifficultyMult(region) ?? 1;
  return Math.max(1, Math.round(BASE_MIN * (level + 1) * mult));
}

export function totalRequiredForLevel(level: number, region: RegionType): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += segmentNeed(i, region);
  return total;
}

export function computeLevelFromTotalMinutes(total: number, region: RegionType): number {
  let lvl = 0;
  while (lvl < MAX_LEVEL && total >= totalRequiredForLevel(lvl + 1, region)) lvl++;
  return lvl;
}

export function applyMinutes(tile: Tile, add: number): Tile {
  const total = Math.max(0, (tile.progress ?? 0) + add);
  const lvl = computeLevelFromTotalMinutes(total, tile.region);
  return { ...tile, progress: total, level: lvl };
}

export function tileProgressRatio(t: Tile): number {
  const level = Math.max(0, Math.min(MAX_LEVEL, t.level));
  const isMax = level >= MAX_LEVEL;
  if (isMax) return 1;

  const start = totalRequiredForLevel(level, t.region);
  const need = segmentNeed(level, t.region);
  const within = Math.max(0, (t.progress ?? 0) - start);
  return Math.max(0, Math.min(1, within / Math.max(1, need)));
}
