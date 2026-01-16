import { all, run } from "../dbCore";
import type { LockedFlag, RegionType, TileFeature } from "../types";
import { INNER_REALM_LAYOUT } from "./innerRealmLayout";
import { FEATURE_BY_CODE, isRegionLockedByDefault, REGION_BY_CODE } from "./regions";

type SeedTile = {
  id: string;
  row: number;
  col: number;
  region: RegionType;
  feature: TileFeature;
  locked: LockedFlag;
  level: number;
  progress: number;
};

export async function seedInnerRealmIfEmpty() {
  const existing = await all<{ c: number }>("SELECT COUNT(*) as c FROM tiles;");
  if ((existing[0]?.c ?? 0) > 0) return;

  const rows = INNER_REALM_LAYOUT.length;
  const cols = INNER_REALM_LAYOUT[0].length;

  const tiles: SeedTile[] = [];

  for (let r = 0; r < rows; r++) {
    const line = INNER_REALM_LAYOUT[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];

      // Default region for special markers:
      // - V/B = void_heart
      // - J = wastelands_ash_dust
      // - G = planes_fire_ice
      const region: RegionType =
        ch >= "1" && ch <= "9"
          ? REGION_BY_CODE[ch as keyof typeof REGION_BY_CODE]
          : ch === "V" || ch === "B"
            ? "void_heart"
            : ch === "J"
              ? "wastelands_ash_dust"
              : ch === "G"
                ? "planes_fire_ice"
                : "wastelands_ash_dust";

      const feature: TileFeature =
        ch === "G" || ch === "V" || ch === "J" || ch === "B"
          ? FEATURE_BY_CODE[ch as keyof typeof FEATURE_BY_CODE]
          : null;

      // Lock by region defaults (e.g., Great Depths, Void Heart)
      const locked = isRegionLockedByDefault(region) ? 1 : 0;

      tiles.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        region,
        feature,
        locked,
        level: 0,
        progress: 0,
      });
    }
  }

  // insert in transaction
  await run("BEGIN;");
  try {
    for (const t of tiles) {
      await run(
        `INSERT INTO tiles (id,row,col,region,level,progress,feature,locked)
         VALUES (?,?,?,?,?,?,?,?);`,
        [t.id, t.row, t.col, t.region, t.level, t.progress, t.feature, t.locked]
      );
    }
    await run("COMMIT;");
  } catch (e) {
    await run("ROLLBACK;");
    throw e;
  }
}
