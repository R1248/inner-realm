import { all, run } from "../dbCore";
import type { LockedFlag, RegionType, TileFeature } from "../types";
import { INNER_REALM_LAYOUT } from "./innerRealmLayout";
import { FEATURE_BY_CODE, REGION_BY_CODE, REGIONS } from "./regions";

type Decoded = {
  region: RegionType;
  feature: TileFeature;
  defaultLocked: LockedFlag;
};

function decodeLayoutChar(ch: string, gateOpened: boolean): Decoded {
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

  // HARD-LOCK only:
  // - Void is permanently blocked
  // - Great Depths are sealed until ANY Gate reaches Level 1
  const defaultLocked: LockedFlag =
    feature === "void" ||
    region === "void_heart" ||
    (region === "great_depths" && !gateOpened)
      ? 1
      : 0;

  return { region, feature, defaultLocked };
}

/**
 * Ensures the DB matches the current INNER_REALM_LAYOUT.
 * - inserts missing tiles (map expansion)
 * - repairs legacy / unknown region ids
 * - updates static fields (row/col/region/feature/locked) WITHOUT touching progress/level
 */
export async function syncInnerRealmToLayout(): Promise<void> {
  const rows = Number(INNER_REALM_LAYOUT.length);
  const cols = Number(INNER_REALM_LAYOUT[0]?.length ?? 0);
  if (!rows || !cols) return;

  const expectedCount = rows * cols;

  const countRow = await all<{ c: number }>("SELECT COUNT(*) as c FROM tiles;");
  const currentCount = Number(countRow[0]?.c ?? 0);

  const legacyRow = await all<{ c: number }>(
    "SELECT COUNT(*) as c FROM tiles WHERE region IN ('wastelands','river','citadel');",
  );
  const legacyCount = Number(legacyRow[0]?.c ?? 0);

  const validRegions = Object.keys(REGIONS) as RegionType[];
  const placeholders = validRegions.map(() => "?").join(",");
  const badRow = await all<{ c: number }>(
    `SELECT COUNT(*) as c FROM tiles WHERE region NOT IN (${placeholders});`,
    validRegions as any,
  );
  const badCount = Number(badRow[0]?.c ?? 0);

  // If counts match and we see no legacy/unknown regions, assume layout is in sync.
  if (currentCount === expectedCount && legacyCount === 0 && badCount === 0) {
    return;
  }

  // If any Gate is already conquered, Great Depths should not be re-locked by sync.
  const gateRow = await all<{ c: number }>(
    "SELECT COUNT(*) as c FROM tiles WHERE feature = 'gate' AND level >= 1;",
  );
  const gateOpened = Number(gateRow[0]?.c ?? 0) > 0;

  const existing = await all<{ id: string; locked: number | null }>(
    "SELECT id, locked FROM tiles;",
  );
  const lockedById = new Map(
    existing.map((r) => [String(r.id), Number(r.locked ?? 0)]),
  );

  await run("BEGIN;");
  try {
    for (let r = 0; r < rows; r++) {
      const line = INNER_REALM_LAYOUT[r];
      for (let c = 0; c < cols; c++) {
        const id = `${r}-${c}`;
        const ch = line[c];

        const { region, feature, defaultLocked } = decodeLayoutChar(
          ch,
          gateOpened,
        );

        const existingLocked = lockedById.get(id);

        if (existingLocked === undefined) {
          await run(
            `INSERT INTO tiles (id,row,col,region,level,progress,feature,locked)
             VALUES (?,?,?,?,?,?,?,?);`,
            [id, r, c, region, 0, 0, feature, defaultLocked],
          );
        } else {
          // Reframe: `locked` only represents world hard-locks.
          await run(
            `UPDATE tiles SET row = ?, col = ?, region = ?, feature = ?, locked = ? WHERE id = ?;`,
            [r, c, region, feature, defaultLocked, id],
          );
        }
      }
    }

    // If the layout SHRANK, remove tiles that now fall outside the layout bounds.
    await run(`DELETE FROM tiles WHERE row >= ? OR col >= ?;`, [rows, cols]);

    // If the target tile was outside bounds and got deleted, clear it.
    await run(
      `UPDATE player
       SET targetTileId = NULL
       WHERE id = 1
         AND targetTileId IS NOT NULL
         AND targetTileId NOT IN (SELECT id FROM tiles);`,
    );

    await run("COMMIT;");
  } catch (e) {
    await run("ROLLBACK;");
    throw e;
  }
}
