import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import type { ActivityType, RegionType, Session, Tile } from "../lib/types";

const MAX_LEVEL = 3;
const BASE_MIN = 60;

const LIGHT_COST = 3;
const BOOST_MINUTES = 60;

function totalRequiredForLevel(level: number) {
  // level 0 -> 0
  // level 1 -> 60
  // level 2 -> 60+120 = 180
  // level 3 -> 60+120+180 = 360
  return (BASE_MIN * (level * (level + 1))) / 2;
}

function computeLevelFromTotalMinutes(total: number) {
  let lvl = 0;
  while (lvl < MAX_LEVEL && total >= totalRequiredForLevel(lvl + 1)) lvl++;
  return lvl;
}

function capTotalMinutes(total: number) {
  const cap = totalRequiredForLevel(MAX_LEVEL);
  return Math.max(0, Math.min(cap, total));
}

function applyMinutes(tile: Tile, addMinutes: number): Tile {
  const total = capTotalMinutes(tile.progress + addMinutes);
  const lvl = computeLevelFromTotalMinutes(total);
  return { ...tile, progress: total, level: lvl };
}

function regionForRow(row: number): RegionType {
  // 7 rows: 0..6
  // top -> Citadel, middle -> River, bottom -> Wastelands
  if (row <= 1) return "citadel";
  if (row <= 3) return "river";
  return "wastelands";
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

function allowedActivitiesForRegion(region: RegionType): ActivityType[] {
  if (region === "citadel") return ["work", "study"];
  if (region === "river") return ["meditation"];
  return ["sport", "habit"];
}

type GameState = {
  isReady: boolean;
  xp: number;
  light: number;

  targetTileId: string | null;

  tiles: Tile[];
  sessions: Session[];

  init: () => Promise<void>;
  setTargetTile: (tileId: string | null) => Promise<void>;

  addSession: (
    activity: ActivityType,
    minutes: number,
    note?: string,
    tileIdOverride?: string
  ) => Promise<void>;

  spendLightBoostTile: (tileId: string) => Promise<void>;

  // Expose constants for UI
  boostMinutes: number;
  boostCost: number;
  baseMin: number;
  maxLevel: number;
};

export const useGameStore = create<GameState>((set, get) => ({
  isReady: false,
  xp: 0,
  light: 0,

  targetTileId: null,

  tiles: [],
  sessions: [],

  boostMinutes: BOOST_MINUTES,
  boostCost: LIGHT_COST,
  baseMin: BASE_MIN,
  maxLevel: MAX_LEVEL,

  init: async () => {
    await initDb();

    // Load player
    const playerRows = await all<{ xp: number; light: number; targetTileId: string | null }>(
      `SELECT xp, light, targetTileId FROM player WHERE id = 1;`
    );
    const xp = Number(playerRows[0]?.xp ?? 0);
    const light = Number(playerRows[0]?.light ?? 0);
    const targetTileId = (playerRows[0]?.targetTileId ?? null) as string | null;

    // Load tiles; if none, create 7x7
    const tileRows = await all<any>(`SELECT id, row, col, region, level, progress FROM tiles;`);

    if (tileRows.length === 0) {
      const tiles: Tile[] = [];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const region = regionForRow(r);
          const progress = 0;
          const level = 0;
          const id = `${r}-${c}`;
          tiles.push({ id, row: r, col: c, region, level, progress });
        }
      }

      for (const t of tiles) {
        await run(
          `INSERT INTO tiles (id, row, col, region, level, progress) VALUES (?, ?, ?, ?, ?, ?);`,
          [t.id, t.row, t.col, t.region, t.level, t.progress]
        );
      }

      set({ xp, light, targetTileId, tiles, sessions: [], isReady: true });
      return;
    }

    const tiles: Tile[] = tileRows.map((t: any) => {
      const progress = Number(t.progress ?? 0);
      const level = Number(t.level ?? computeLevelFromTotalMinutes(progress));
      return {
        id: String(t.id),
        row: Number(t.row),
        col: Number(t.col),
        region: t.region as RegionType,
        progress,
        level,
      };
    });

    const sessionsRaw = await all<any>(
      `SELECT id, createdAt, activity, minutes, note FROM sessions ORDER BY createdAt DESC LIMIT 200;`
    );

    const sessions: Session[] = sessionsRaw.map((s: any) => ({
      id: String(s.id),
      createdAt: Number(s.createdAt),
      activity: s.activity as ActivityType,
      minutes: Number(s.minutes),
      note: s.note ?? null,
    }));

    set({ xp, light, targetTileId, tiles, sessions, isReady: true });
  },

  setTargetTile: async (tileId) => {
    await run(`UPDATE player SET targetTileId = ? WHERE id = 1;`, [tileId ?? null]);
    set({ targetTileId: tileId ?? null });
  },

  addSession: async (activity, minutes, note, tileIdOverride) => {
    const m = Math.max(0, Math.floor(minutes));
    if (m <= 0) return;

    const xpGain = Math.max(1, Math.round(m)); // 1 XP per minute
    const lightGain = Math.max(1, Math.round(m / 10)); // 1 Light per 10 minutes (min 1)

    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;

    const tiles = [...get().tiles];

    // Decide where minutes go:
    // 1) tileIdOverride (one-time "log into this tile")
    // 2) targetTileId (persistent target)
    // 3) auto-pick in region based on activity
    const forcedId = tileIdOverride ?? null;
    const targetId = get().targetTileId ?? null;

    let chosen: Tile | null = null;
    if (forcedId) {
      chosen = tiles.find((t) => t.id === forcedId) ?? null;
    } else if (targetId) {
      chosen = tiles.find((t) => t.id === targetId) ?? null;
    } else {
      const region = activityToRegion(activity);
      const candidates = tiles
        .filter((t) => t.region === region)
        .sort((a, b) => a.progress - b.progress || a.level - b.level || a.row - b.row || a.col - b.col);
      chosen = candidates[0] ?? null;
    }

    if (!chosen) return;

    // Validate activity matches the chosen tile region if the user explicitly targets a tile (forced or persistent)
    // (UI should already prevent this, but we enforce it here too.)
    if (forcedId || targetId) {
      const allowed = allowedActivitiesForRegion(chosen.region);
      if (!allowed.includes(activity)) {
        return;
      }
    }

    const idx = tiles.findIndex((t) => t.id === chosen!.id);
    const nextTile = applyMinutes(chosen, m);
    tiles[idx] = nextTile;

    // Write session (real minutes only)
    await run(
      `INSERT INTO sessions (id, createdAt, activity, minutes, note) VALUES (?, ?, ?, ?, ?);`,
      [id, now, activity, m, note?.trim() ? note.trim() : null]
    );

    // Update player
    const nextXp = get().xp + xpGain;
    const nextLight = get().light + lightGain;
    await run(`UPDATE player SET xp = ?, light = ? WHERE id = 1;`, [nextXp, nextLight]);

    // Update tile minutes/level
    await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [
      nextTile.level,
      nextTile.progress,
      nextTile.id,
    ]);

    const newSession: Session = {
      id,
      createdAt: now,
      activity,
      minutes: m,
      note: note?.trim() ? note.trim() : null,
    };

    set({
      xp: nextXp,
      light: nextLight,
      tiles,
      sessions: [newSession, ...get().sessions],
    });
  },

  spendLightBoostTile: async (tileId) => {
    const { light, tiles } = get();
    if (light < LIGHT_COST) return;

    const idx = tiles.findIndex((t) => t.id === tileId);
    if (idx === -1) return;

    const t = tiles[idx];
    if (t.level >= MAX_LEVEL) return;

    const nextTile = applyMinutes(t, BOOST_MINUTES);
    const nextLight = light - LIGHT_COST;

    await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [
      nextTile.level,
      nextTile.progress,
      nextTile.id,
    ]);
    await run(`UPDATE player SET light = ? WHERE id = 1;`, [nextLight]);

    const nextTiles = [...tiles];
    nextTiles[idx] = nextTile;

    set({ light: nextLight, tiles: nextTiles });
  },
}));
