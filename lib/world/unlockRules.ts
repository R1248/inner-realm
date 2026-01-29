import type { Tile } from "../types";

/**
 * Accessibility rules.
 *
 * - `locked === 1` = HARD-LOCKED by world rules (Void / Great Depths before Gate).
 * - Tiles are visible, but investable only if they touch a conquered tile (edge OR corner).
 * - A tile becomes "conquered" once it reaches Level >= 1.
 */

export type TileIndex = {
  byId: Map<string, Tile>;
  byPos: Map<string, Tile>;
};

function posKey(row: number, col: number) {
  return `${row}-${col}`;
}

export function buildTileIndex(tiles: Tile[]): TileIndex {
  const byId = new Map<string, Tile>();
  const byPos = new Map<string, Tile>();
  for (const t of tiles) {
    byId.set(t.id, t);
    byPos.set(posKey(t.row, t.col), t);
  }
  return { byId, byPos };
}

const N8: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function neighbors8(row: number, col: number): [number, number][] {
  return N8.map(([dr, dc]) => [row + dr, col + dc]);
}

export function isHardLocked(tile: Tile): boolean {
  return tile.locked === 1 || tile.feature === "void" || tile.region === "void_heart";
}

export function isTileBlocked(tile: Tile): boolean {
  return tile.feature === "void" || tile.region === "void_heart";
}

export function isTileHardLocked(tile: Tile): boolean {
  return isHardLocked(tile);
}

export function isConquered(tile: Tile): boolean {
  return tile.level >= 1 && !isHardLocked(tile);
}

export function isTileConquered(tile: Tile): boolean {
  return isConquered(tile);
}

function touchesConquered(tile: Tile, index: TileIndex): boolean {
  for (const [nr, nc] of neighbors8(tile.row, tile.col)) {
    const nb = index.byPos.get(posKey(nr, nc));
    if (nb && isConquered(nb)) return true;
  }
  return false;
}

export function isFrontier(tile: Tile, index: TileIndex): boolean {
  return tile.level === 0 && !isHardLocked(tile) && touchesConquered(tile, index);
}

export function isFrontierTile(tile: Tile, index: TileIndex): boolean {
  return isFrontier(tile, index);
}

export function canInvest(tile: Tile, index: TileIndex): boolean {
  return isConquered(tile) || isFrontier(tile, index);
}

export function canInvestIntoTile(tile: Tile, index: TileIndex): boolean {
  return canInvest(tile, index);
}

export function canUnlockTile(tile: Tile, index: TileIndex): boolean {
  return isFrontier(tile, index);
}

export function hasOpenedGate(tilesOrIndex: Tile[] | TileIndex): boolean {
  const tiles = Array.isArray(tilesOrIndex)
    ? tilesOrIndex
    : Array.from(tilesOrIndex.byId.values());
  for (const t of tiles) {
    if (t.feature === "gate" && t.level >= 1) return true;
  }
  return false;
}

export async function applyGateUnlock(
  run: (sql: string, params?: any[]) => Promise<any>,
): Promise<void> {
  await run(`UPDATE tiles SET locked = 0 WHERE region = 'great_depths' AND locked = 1;`);
}

export function computeInvestableIds(tiles: Tile[]): Set<string> {
  const index = buildTileIndex(tiles);
  const ids = new Set<string>();
  for (const t of tiles) {
    if (canInvest(t, index)) ids.add(t.id);
  }
  return ids;
}

export function investabilityReason(tile: Tile, index: TileIndex): string {
  if (isHardLocked(tile)) {
    if (tile.feature === "void" || tile.region === "void_heart") {
      return "Void. Permanently inaccessible.";
    }
    if (tile.region === "great_depths") {
      return "Sealed: Great Depths. Open any Gate tile (reach Level 1 on a Gate) to break the seal.";
    }
    return "Sealed by world rules.";
  }

  if (isConquered(tile)) {
    return "Conquered. Upgrade this tile to strengthen it.";
  }

  if (isFrontier(tile, index)) {
    return "Frontier. Invest here; once you reach Level 1, this tile becomes conquered and expands your frontier.";
  }

  return "Not reachable yet. Reach Level 1 on any neighboring tile to extend your frontier.";
}

export function unlockHint(tile: Tile, index: TileIndex): string {
  return investabilityReason(tile, index);
}

/**
 * Picks a reasonable start anchor tile id.
 * Used to bootstrap older DBs if no conquered tile exists.
 */
export function pickStartAnchorId(tiles: Tile[]): string | null {
  if (!tiles.length) return null;

  const preferred = tiles.find(
    (t) =>
      t.row === 3 &&
      t.col === 3 &&
      t.region === "mountains_doubt" &&
      !isHardLocked(t),
  );
  if (preferred) return preferred.id;

  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const midR = Math.floor(rows / 2);

  const candidates = tiles.filter(
    (t) => t.region === "mountains_doubt" && !isHardLocked(t),
  );

  const pool = candidates.length
    ? candidates
    : tiles.filter((t) => !isHardLocked(t));

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
