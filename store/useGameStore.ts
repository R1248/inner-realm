import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import type { ActivityType, RegionType, Session, Tile } from "../lib/types";

type GameState = {
  isReady: boolean;
  xp: number;
  light: number;

  tiles: Tile[];
  sessions: Session[];

  targetTileId: string | null;

  // UI-friendly constants
  boostCost: number;
  boostMinutes: number;

  init: () => Promise<void>;
  setTargetTile: (tileId: string | null) => Promise<void>;

  // tileIdOverride = "log session into this tile"
  addSession: (activity: ActivityType, minutes: number, note?: string, tileIdOverride?: string) => Promise<void>;

  spendLightBoostTile: (tileId: string) => Promise<void>;
};

const MAP_SIZE = 30;      // 30×30
const MAX_LEVEL = 3;
const BASE_MIN = 60;

// multipliers: citadel dražší, wasteland levnější
const REGION_MULT: Record<RegionType, number> = {
  wastelands: 0.75, // 45,90,135...
  river: 1.0,       // 60,120,180...
  citadel: 1.5,     // 90,180,270...
};

function allowedActivitiesForRegion(region: RegionType): ActivityType[] {
  if (region === "citadel") return ["work", "study"];
  if (region === "river") return ["meditation"];
  return ["sport", "habit"];
}

function activityToRegion(activity: ActivityType): RegionType {
  switch (activity) {
    case "meditation":
      return "river";
    case "work":
    case "study":
      return "citadel";
    case "sport":
    case "habit":
    default:
      return "wastelands";
  }
}

// --- cumulative thresholds by region ---
// segment need for going from level -> level+1 (e.g. 0->1, 1->2,...)
function segmentNeed(level: number, region: RegionType): number {
  const mult = REGION_MULT[region] ?? 1;
  // 0->1: BASE_MIN*(1)*mult; 1->2: BASE_MIN*(2)*mult; ...
  return Math.max(1, Math.round(BASE_MIN * (level + 1) * mult));
}

// total required to reach `level` (cumulative sum of segments up to level-1)
function totalRequiredForLevel(level: number, region: RegionType): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += segmentNeed(i, region);
  return total;
}

function computeLevelFromTotalMinutes(total: number, region: RegionType): number {
  let lvl = 0;
  while (lvl < MAX_LEVEL && total >= totalRequiredForLevel(lvl + 1, region)) lvl++;
  return lvl;
}

function applyMinutes(tile: Tile, add: number): Tile {
  const total = Math.max(0, (tile.progress ?? 0) + add);
  const lvl = computeLevelFromTotalMinutes(total, tile.region);
  return { ...tile, progress: total, level: lvl };
}

// --- map generation (meandering river) ---
function noise01(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function riverCenterCol(row: number, size: number) {
  const mid = Math.floor(size * 0.55); // river spíš trochu blíž k východu
  const a1 = 5;
  const a2 = 2;
  const s1 = Math.sin(row / 4);
  const s2 = Math.sin(row / 9);
  const n = (noise01(row + 123) - 0.5) * 2; // -1..1
  const center = Math.round(mid + a1 * s1 + a2 * s2 + n * 1.5);
  return Math.max(6, Math.min(size - 7, center));
}

function riverWidth(row: number) {
  // většinou 1, občas 2 pro “živost”
  return noise01(row + 777) > 0.82 ? 2 : 1;
}

function generateTiles(size: number): Tile[] {
  const out: Tile[] = [];
  for (let r = 0; r < size; r++) {
    const center = riverCenterCol(r, size);
    const w = riverWidth(r);
    for (let c = 0; c < size; c++) {
      let region: RegionType;
      if (Math.abs(c - center) <= w) region = "river";
      else if (c > center + w) region = "citadel";
      else region = "wastelands";

      out.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        region,
        level: 0,
        progress: 0,
      });
    }
  }
  return out;
}

function normalizeTiles(rows: any[]): Tile[] {
  return rows.map((t: any) => ({
    id: String(t.id),
    row: Number(t.row),
    col: Number(t.col),
    region: t.region as RegionType,
    level: Number(t.level),
    progress: Number(t.progress ?? 0),
  }));
}

function normalizeSessions(rows: any[]): Session[] {
  return rows.map((s: any) => ({
    id: String(s.id),
    createdAt: Number(s.createdAt),
    activity: s.activity as ActivityType,
    minutes: Number(s.minutes),
    note: s.note ?? null,
  }));
}

export const useGameStore = create<GameState>((set, get) => ({
  isReady: false,
  xp: 0,
  light: 0,
  tiles: [],
  sessions: [],
  targetTileId: null,

  boostCost: 3,
  boostMinutes: 60,

  init: async () => {
    await initDb();

    // Player
    const playerRows = await all<{ xp: number; light: number; targetTileId?: string | null }>(
      `SELECT xp, light, targetTileId FROM player WHERE id = 1;`
    );
    const xp = Number(playerRows[0]?.xp ?? 0);
    const light = Number(playerRows[0]?.light ?? 0);
    const targetTileId = (playerRows[0]?.targetTileId ?? null) as string | null;

    // Tiles
    const tileRows = await all<any>(`SELECT id, row, col, region, level, progress FROM tiles;`);

    // Sessions
    const sessionRows = await all<any>(
      `SELECT id, createdAt, activity, minutes, note FROM sessions ORDER BY createdAt DESC LIMIT 500;`
    );

    // If no tiles or old grid size, regenerate to 30×30
    const needsRegen =
      tileRows.length !== MAP_SIZE * MAP_SIZE ||
      !tileRows.some((t) => Number(t.row) === MAP_SIZE - 1 && Number(t.col) === MAP_SIZE - 1);

    if (tileRows.length === 0 || needsRegen) {
      const newTiles = generateTiles(MAP_SIZE);

      await run(`DELETE FROM tiles;`);
      // reset target (tile ids might change)
      await run(`UPDATE player SET targetTileId = NULL WHERE id = 1;`);

      for (const t of newTiles) {
        await run(
          `INSERT INTO tiles (id, row, col, region, level, progress) VALUES (?, ?, ?, ?, ?, ?);`,
          [t.id, t.row, t.col, t.region, t.level, t.progress]
        );
      }

      set({
        isReady: true,
        xp,
        light,
        tiles: newTiles,
        sessions: normalizeSessions(sessionRows),
        targetTileId: null,
      });
      return;
    }

    const tiles = normalizeTiles(tileRows);
    const sessions = normalizeSessions(sessionRows);

    // Drop target if it doesn't exist anymore
    const targetExists = targetTileId ? tiles.some((t) => t.id === targetTileId) : true;

    set({
      isReady: true,
      xp,
      light,
      tiles,
      sessions,
      targetTileId: targetExists ? targetTileId : null,
    });
  },

  setTargetTile: async (tileId) => {
    await run(`UPDATE player SET targetTileId = ? WHERE id = 1;`, [tileId ?? null]);
    set({ targetTileId: tileId ?? null });
  },

  addSession: async (activity, minutes, note, tileIdOverride) => {
    const safeMinutes = Math.max(1, Math.floor(Number(minutes) || 0));
    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;

    const xpGain = safeMinutes;
    const lightGain = Math.max(1, Math.floor(safeMinutes / 10));

    const tiles = [...get().tiles];
    const targetTileId = get().targetTileId;

    // Decide tile to receive minutes:
    // 1) tileIdOverride (log into tile)
    // 2) targetTileId
    // 3) auto-pick based on activity region
    let chosen: Tile | null = null;

    const overrideId = tileIdOverride ?? null;
    const forcedId = overrideId ?? targetTileId ?? null;

    if (forcedId) {
      chosen = tiles.find((t) => t.id === forcedId) ?? null;
      if (!chosen) return;

      // Validate activity matches chosen.region
      const allowed = allowedActivitiesForRegion(chosen.region);
      if (!allowed.includes(activity)) {
        // invalid log attempt -> ignore (UI should prevent this)
        return;
      }
    } else {
      const region = activityToRegion(activity);
      const candidates = tiles.filter((t) => t.region === region && t.level < MAX_LEVEL);
      if (candidates.length > 0) {
        // pick lowest level, then lowest progress ratio
        candidates.sort((a, b) => {
          if (a.level !== b.level) return a.level - b.level;

          const aStart = totalRequiredForLevel(a.level, a.region);
          const bStart = totalRequiredForLevel(b.level, b.region);
          const aNeed = segmentNeed(a.level, a.region);
          const bNeed = segmentNeed(b.level, b.region);
          const aRatio = aNeed > 0 ? (a.progress - aStart) / aNeed : 0;
          const bRatio = bNeed > 0 ? (b.progress - bStart) / bNeed : 0;

          if (aRatio !== bRatio) return aRatio - bRatio;
          return a.row - b.row || a.col - b.col;
        });
        chosen = candidates[0];
      }
    }

    // Write session to DB
    await run(
      `INSERT INTO sessions (id, createdAt, activity, minutes, note) VALUES (?, ?, ?, ?, ?);`,
      [id, now, activity, safeMinutes, note ?? null]
    );

    // Update player xp/light
    const nextXp = get().xp + xpGain;
    const nextLight = get().light + lightGain;
    await run(`UPDATE player SET xp = ?, light = ? WHERE id = 1;`, [nextXp, nextLight]);

    // Apply minutes to chosen tile
    if (chosen) {
      const idx = tiles.findIndex((t) => t.id === chosen!.id);
      const updated = applyMinutes(chosen, safeMinutes);
      tiles[idx] = updated;

      await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [
        updated.level,
        updated.progress,
        updated.id,
      ]);
    }

    const newSession: Session = {
      id,
      createdAt: now,
      activity,
      minutes: safeMinutes,
      note: note ?? null,
    };

    set({
      xp: nextXp,
      light: nextLight,
      tiles,
      sessions: [newSession, ...get().sessions],
    });
  },

  spendLightBoostTile: async (tileId) => {
    const { tiles, light, boostCost, boostMinutes } = get();
    if (light < boostCost) return;

    const idx = tiles.findIndex((t) => t.id === tileId);
    if (idx === -1) return;

    const t = tiles[idx];
    if (t.level >= MAX_LEVEL) return;

    const nextLight = light - boostCost;
    const updated = applyMinutes(t, boostMinutes);

    await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [
      updated.level,
      updated.progress,
      updated.id,
    ]);
    await run(`UPDATE player SET light = ? WHERE id = 1;`, [nextLight]);

    const nextTiles = [...tiles];
    nextTiles[idx] = updated;

    set({ light: nextLight, tiles: nextTiles });
  },
}));
