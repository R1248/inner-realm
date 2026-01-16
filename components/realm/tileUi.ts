import type { Tile } from "../../lib/types";
import { levelBg as regionLevelBg, regionColors as regionColorsFromDefs } from "../../lib/world/regions";
import {
  BASE_MIN,
  MAX_LEVEL,
  segmentNeed,
  tileProgressRatio,
  totalRequiredForLevel,
} from "../../lib/world/progression";

// Re-export to keep existing component imports stable
export { BASE_MIN, MAX_LEVEL, segmentNeed, tileProgressRatio, totalRequiredForLevel };

export function regionColors(region: Tile["region"]) {
  return regionColorsFromDefs(region);
}

export function levelBg(region: Tile["region"], level: number) {
  return regionLevelBg(region, level);
}
