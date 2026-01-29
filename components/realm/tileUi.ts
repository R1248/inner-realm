import {
  regionColors as regionColorsFromDefs,
  levelBg as regionLevelBg,
} from "@/lib/world/regions";
import type { Tile } from "../../lib/types";
import {
  BASE_MIN,
  MAX_LEVEL,
  segmentNeed,
  tileProgressRatio,
  totalRequiredForLevel,
} from "../../lib/world/progression";

// Re-export to keep existing component imports stable
export {
  BASE_MIN,
  MAX_LEVEL,
  segmentNeed,
  tileProgressRatio,
  totalRequiredForLevel
};

export function regionColors(region: Tile["region"]) {
  return regionColorsFromDefs(region);
}

export function levelBg(region: Tile["region"], level: number) {
  return regionLevelBg(region, level);
}
