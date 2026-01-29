import { all, run } from "../dbCore";
import type { LockedFlag, RegionType, Tile, TileFeature } from "../types";
import { INNER_REALM_LAYOUT } from "./innerRealmLayout";
import { totalRequiredForLevel } from "./progression";
import { FEATURE_BY_CODE, REGION_BY_CODE } from "./regions";

type Decoded = {
  region: RegionType;
  feature: TileFeature;
  hardLocked: LockedFlag;
};

function decodeLayoutChar(ch: string): Decoded {
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

  // HARD-LOCK only: Void + Great Depths (until a Gate is opened)
  const hardLocked: LockedFlag =
    feature === "void" || region === "void_heart" || region === "great_depths"
      ? 1
      : 0;

  return { region, feature, hardLocked };
}

function pickSeedStartTileId(tiles: Tile[]): string | null {
  if (!tiles.length) return null;
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const midR = Math.floor(rows / 2);

  // Prefer Mountains of Doubt.
  const candidates = tiles.filter(
    (t) =>
      t.region === "mountains_doubt" && t.locked === 0 && t.feature !== "void",
  );
  const pool = candidates.length
    ? candidates
    : tiles.filter((t) => t.locked === 0 && t.feature !== "void");

  if (!pool.length) return null;

  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of pool) {
    const score = t.col * 2 + Math.abs(t.row - midR);
    if (score < bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best.id;
}

export async function seedInnerRealmIfEmpty(): Promise<void> {
  const row = await all<{ c: number }>("SELECT COUNT(*) as c FROM tiles;");
  const count = Number(row[0]?.c ?? 0);
  if (count > 0) return;

  const rows = Number(INNER_REALM_LAYOUT.length);
  const cols = Number(INNER_REALM_LAYOUT[0]?.length ?? 0);
  if (!rows || !cols) return;

  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    const line = INNER_REALM_LAYOUT[r];
    for (let c = 0; c < cols; c++) {
      const id = `${r}-${c}`;
      const ch = line[c];
      const { region, feature, hardLocked } = decodeLayoutChar(ch);
      tiles.push({
        id,
        row: r,
        col: c,
        region,
        level: 0,
        progress: 0,
        feature,
        locked: hardLocked,
      });
    }
  }

  // Start with one conquered tile so the frontier rules can expand from it.
  const preferred = tiles.find(
    (t) =>
      t.row === 3 &&
      t.col === 3 &&
      t.region === "mountains_doubt" &&
      t.locked === 0 &&
      t.feature !== "void",
  );
  const startId = preferred?.id ?? pickSeedStartTileId(tiles);
  if (startId) {
    const t = tiles.find((x) => x.id === startId);
    if (t) {
      const req = totalRequiredForLevel(1, t.region);
      t.level = 1;
      t.progress = req;
    }
  }

  await run("BEGIN;");
  try {
    for (const t of tiles) {
      await run(
        `INSERT INTO tiles (id,row,col,region,level,progress,feature,locked)
         VALUES (?,?,?,?,?,?,?,?);`,
        [
          t.id,
          t.row,
          t.col,
          t.region,
          t.level,
          t.progress,
          t.feature,
          t.locked,
        ],
      );
    }
    await run("COMMIT;");
  } catch (e) {
    await run("ROLLBACK;");
    throw e;
  }
}
