import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import type { ActivityType, LockedFlag, Session, Tile, TileFeature } from "../lib/types";
import { allowedActivitiesForRegion, regionTier } from "../lib/world/regions";
import { applyMinutes, MAX_LEVEL, tileProgressRatio } from "../lib/world/progression";

type GameState = {
  isReady: boolean;
  xp: number;
  light: number;

  tiles: Tile[];
  sessions: Session[];

  targetTileId: string | null;

  boostCost: number;
  boostMinutes: number;

  init: () => Promise<void>;
  setTargetTile: (tileId: string | null) => Promise<void>;

  // tileIdOverride = "log session into this tile"
  addSession: (activity: ActivityType, minutes: number, note?: string, tileIdOverride?: string) => Promise<void>;

  spendLightBoostTile: (tileId: string) => Promise<void>;
};

function normalizeTiles(rows: any[]): Tile[] {
  return rows.map((t: any) => {
    const locked = Number(t.locked ?? 0) ? 1 : 0;
    return {
      id: String(t.id),
      row: Number(t.row),
      col: Number(t.col),
      region: t.region,
      level: Number(t.level),
      progress: Number(t.progress ?? 0),
      feature: (t.feature ?? null) as TileFeature,
      locked: locked as LockedFlag,
    } satisfies Tile;
  });
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
    const targetTileIdRaw = (playerRows[0]?.targetTileId ?? null) as string | null;

    // Tiles
    const tileRows = await all<any>(
      `SELECT id, row, col, region, level, progress, feature, locked FROM tiles;`
    );

    // Sessions
    const sessionRows = await all<any>(
      `SELECT id, createdAt, activity, minutes, note FROM sessions ORDER BY createdAt DESC LIMIT 500;`
    );

    const tiles = normalizeTiles(tileRows);
    const sessions = normalizeSessions(sessionRows);

    // Validate target: must exist AND not be locked
    let targetTileId: string | null = targetTileIdRaw;
    const targetOk = targetTileId ? tiles.some((t) => t.id === targetTileId && t.locked === 0) : true;

    if (!targetOk) {
      targetTileId = null;
      await run(`UPDATE player SET targetTileId = NULL WHERE id = 1;`);
    }

    set({
      isReady: true,
      xp,
      light,
      tiles,
      sessions,
      targetTileId,
    });
  },

  setTargetTile: async (tileId) => {
    if (tileId) {
      const t = get().tiles.find((x) => x.id === tileId) ?? null;
      if (!t || t.locked === 1) return;
    }

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
    // 1) tileIdOverride (log session into this tile)
    // 2) targetTileId (if set)
    // 3) auto-pick: any tile that allows the activity
    let chosen: Tile | null = null;

    const forcedId = (tileIdOverride ?? targetTileId) ?? null;

    if (forcedId) {
      const forced = tiles.find((t) => t.id === forcedId) ?? null;
      if (!forced) return;

      // locked tiles cannot receive minutes
      if (forced.locked === 1) return;

      // Validate activity matches chosen.region (rules come from region registry)
      const allowed = allowedActivitiesForRegion(forced.region);
      if (!allowed.includes(activity)) return;

      chosen = forced;
    } else {
      let candidates = tiles.filter(
        (t) => t.locked === 0 && t.level < MAX_LEVEL && allowedActivitiesForRegion(t.region).includes(activity)
      );

      // If you maxed all tiles for this activity, fall back to any non-locked tile.
      if (candidates.length === 0) {
        candidates = tiles.filter((t) => t.locked === 0 && t.level < MAX_LEVEL);
      }

      if (candidates.length > 0) {
        // pick:
        // 1) lowest region tier (earlier regions first)
        // 2) lowest level
        // 3) lowest progress ratio within current segment
        // 4) stable by row/col
        candidates.sort((a, b) => {
          const ta = regionTier(a.region);
          const tb = regionTier(b.region);
          if (ta !== tb) return ta - tb;

          if (a.level !== b.level) return a.level - b.level;

          const ar = tileProgressRatio(a);
          const br = tileProgressRatio(b);
          if (ar !== br) return ar - br;

          return a.row - b.row || a.col - b.col;
        });

        chosen = candidates[0];
      }
    }

    await run("BEGIN;");
    try {
      // Session row
      await run(`INSERT INTO sessions (id, createdAt, activity, minutes, note) VALUES (?, ?, ?, ?, ?);`, [
        id,
        now,
        activity,
        safeMinutes,
        note ?? null,
      ]);

      // Player xp/light
      const nextXp = get().xp + xpGain;
      const nextLight = get().light + lightGain;
      await run(`UPDATE player SET xp = ?, light = ? WHERE id = 1;`, [nextXp, nextLight]);

      // Tile update if chosen
      let nextTiles = tiles;
      if (chosen) {
        const idx = tiles.findIndex((t) => t.id === chosen!.id);
        const updated = applyMinutes(chosen, safeMinutes);
        nextTiles = [...tiles];
        nextTiles[idx] = updated;

        await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [updated.level, updated.progress, updated.id]);
      }

      await run("COMMIT;");

      const newSession: Session = {
        id,
        createdAt: now,
        activity,
        minutes: safeMinutes,
        note: note ?? null,
      };

      set({
        xp: get().xp + xpGain,
        light: get().light + lightGain,
        tiles: nextTiles,
        sessions: [newSession, ...get().sessions],
      });
    } catch (e) {
      await run("ROLLBACK;");
      throw e;
    }
  },

  spendLightBoostTile: async (tileId) => {
    const { tiles, light, boostCost, boostMinutes } = get();
    if (light < boostCost) return;

    const idx = tiles.findIndex((t) => t.id === tileId);
    if (idx === -1) return;

    const t = tiles[idx];

    // locked / maxed tiles cannot be boosted
    if (t.locked === 1) return;
    if (t.level >= MAX_LEVEL) return;

    const nextLight = light - boostCost;
    const updated = applyMinutes(t, boostMinutes);

    await run("BEGIN;");
    try {
      await run(`UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`, [updated.level, updated.progress, updated.id]);
      await run(`UPDATE player SET light = ? WHERE id = 1;`, [nextLight]);
      await run("COMMIT;");
    } catch (e) {
      await run("ROLLBACK;");
      throw e;
    }

    const nextTiles = [...tiles];
    nextTiles[idx] = updated;

    set({ light: nextLight, tiles: nextTiles });
  },
}));
