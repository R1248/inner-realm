import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import {
  isCoreActivity,
  normalizeActivity,
  resourceGainsForSession,
} from "../lib/resourceModel";
import type {
  ActivityType,
  LockedFlag,
  Session,
  Tile,
  TileFeature,
} from "../lib/types";
import { applyMinutes, MAX_LEVEL, totalRequiredForLevel } from "../lib/world/progression";
import { allowedActivitiesForRegion } from "../lib/world/regions";
import {
  applyGateUnlock,
  buildTileIndex,
  canInvest,
  hasOpenedGate,
  investabilityReason,
  pickStartAnchorId,
} from "../lib/world/unlockRules";

type SpendableResource = "craft" | "lore" | "vigor" | "clarity";

const ACTIVITY_FOR_RESOURCE: Record<SpendableResource, ActivityType> = {
  craft: "work",
  lore: "study",
  vigor: "sport",
  clarity: "mindfulness",
};

function isActivityAllowedOnTile(activity: ActivityType, tile: Tile): boolean {
  const a = normalizeActivity(activity);
  const allowed = allowedActivitiesForRegion(tile.region);

  // Backwards-compat: some realms still list "meditation".
  if (a === "mindfulness" && allowed.includes("meditation")) return true;

  return allowed.includes(a);
}

function clampInt(n: any, min: number, max?: number): number {
  const v = Math.floor(Number(n) || 0);
  if (typeof max === "number") return Math.max(min, Math.min(max, v));
  return Math.max(min, v);
}

type GameState = {
  isReady: boolean;

  // player stats
  xp: number;
  craft: number;
  lore: number;
  vigor: number;
  clarity: number;
  gold: number;

  tiles: Tile[];
  sessions: Session[];

  targetTileId: string | null;

  init: () => Promise<void>;
  setTargetTile: (tileId: string | null) => Promise<void>;

  // NOTE: sessions no longer invest into tiles; they only grant resources.
  addSession: (
    activity: ActivityType,
    minutes: number,
    subtype?: string | null,
    amount?: number | null,
    note?: string,
  ) => Promise<
    | { ok: true; tileId: string | null; unlockedTile: boolean }
    | { ok: false; reason: string }
  >;

  /** Spend a resource pool to progress a tile (and unlock it once it reaches Level 1). */
  spendResourceOnTile: (
    tileId: string,
    resource: SpendableResource,
    minutes: number,
  ) => Promise<
    | { ok: true; unlockedNow: boolean }
    | { ok: false; reason: string }
  >;

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
    subtype: s.subtype ?? null,
    amount: s.amount ?? null,
  }));
}

export const useGameStore = create<GameState>((set, get) => ({
  isReady: false,

  xp: 0,
  craft: 0,
  lore: 0,
  vigor: 0,
  clarity: 0,
  gold: 0,

  tiles: [],
  sessions: [],
  targetTileId: null,

  init: async () => {
    await initDb();

    // Player
    const playerRows = await all<{
      xp: number;
      craft: number;
      lore: number;
      vigor: number;
      clarity: number;
      gold: number;
      targetTileId?: string | null;
    }>(
      `SELECT xp, craft, lore, vigor, clarity, gold, targetTileId FROM player WHERE id = 1;`,
    );

    const xp = Number(playerRows[0]?.xp ?? 0);
    const craft = Number(playerRows[0]?.craft ?? 0);
    const lore = Number(playerRows[0]?.lore ?? 0);
    const vigor = Number(playerRows[0]?.vigor ?? 0);
    const clarity = Number(playerRows[0]?.clarity ?? 0);
    const gold = Number(playerRows[0]?.gold ?? 0);
    const targetTileIdRaw = (playerRows[0]?.targetTileId ?? null) as string | null;

    // Tiles
    const tileRows = await all<any>(
      `SELECT id, row, col, region, level, progress, feature, locked FROM tiles;`,
    );

    // Sessions
    const sessionRows = await all<any>(
      `SELECT id, createdAt, activity, minutes, note, subtype, amount
       FROM sessions
       ORDER BY createdAt DESC
       LIMIT 500;`,
    );

    let tiles = normalizeTiles(tileRows);
    const sessions = normalizeSessions(sessionRows);

    // If any Gate is conquered, ensure Great Depths are not hard-locked (older DBs).
    const gateIndex = buildTileIndex(tiles);
    if (hasOpenedGate(gateIndex)) {
      const anyLockedDepths = tiles.some((t) => t.region === "great_depths" && t.locked === 1);
      if (anyLockedDepths) {
        await run(`UPDATE tiles SET locked = 0 WHERE region = 'great_depths' AND locked = 1;`);
        tiles = tiles.map((t) =>
          t.region === "great_depths"
            ? ({ ...t, locked: 0 as LockedFlag } satisfies Tile)
            : t,
        );
      }
    }

    // Bootstrap: ensure at least one conquered tile exists.
    const hasConquered = tiles.some((t) => t.level >= 1 && t.feature !== "void" && t.locked === 0);
    if (!hasConquered) {
      const startId = pickStartAnchorId(tiles);
      if (startId) {
        const start = tiles.find((t) => t.id === startId);
        if (start) {
          const req = totalRequiredForLevel(1, start.region);
          await run(`UPDATE tiles SET level = 1, progress = ? WHERE id = ?;`, [req, startId]);
          tiles = tiles.map((t) =>
            t.id === startId ? ({ ...t, level: 1, progress: req } satisfies Tile) : t,
          );
        }
      }
    }

    // Validate target: must exist AND not be hard-locked / Void
    let targetTileId: string | null = targetTileIdRaw;
    const tileIndex = buildTileIndex(tiles);
    const target = targetTileId ? (tileIndex.byId.get(targetTileId) ?? null) : null;
    const targetOk = target ? (target.feature !== "void" && target.locked === 0) : true;

    if (!targetOk) {
      targetTileId = null;
      await run(`UPDATE player SET targetTileId = NULL WHERE id = 1;`);
    }

    set({
      isReady: true,
      xp,
      craft,
      lore,
      vigor,
      clarity,
      gold,
      tiles,
      sessions,
      targetTileId,
    });
  },

  setTargetTile: async (tileId) => {
    if (tileId) {
      const tiles = get().tiles;
      const index = buildTileIndex(tiles);
      const t = index.byId.get(tileId) ?? null;
      if (!t) return;
      if (t.feature === "void" || t.locked === 1) return;
    }

    await run(`UPDATE player SET targetTileId = ? WHERE id = 1;`, [tileId ?? null]);
    set({ targetTileId: tileId ?? null });
  },


  addSession: async (activityRaw, minutes, subtype, amount, note) => {
    const activity = normalizeActivity(activityRaw);

    const isIncome = activity === "income";
    const isCore = isCoreActivity(activity);

    const safeMinutes = isIncome ? 0 : clampInt(minutes, 1);
    const safeAmount = amount == null ? null : Math.floor(Number(amount) || 0);

    if (isIncome) {
      if (!safeAmount || safeAmount <= 0) {
        return { ok: false, reason: "Income sessions require a positive amount." };
      }
    }

    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;

    // XP is tied to time, and only for core activities.
    const xpGain = isCore ? safeMinutes : 0;

    const delta = resourceGainsForSession({
      activity,
      minutes: safeMinutes,
      amount: safeAmount,
      subtype,
    });

    await run("BEGIN;");
    try {
      // Player
      const nextXp = get().xp + xpGain;
      const nextCraft = get().craft + Number(delta.craft ?? 0);
      const nextLore = get().lore + Number(delta.lore ?? 0);
      const nextVigor = get().vigor + Number(delta.vigor ?? 0);
      const nextClarity = get().clarity + Number(delta.clarity ?? 0);
      const nextGold = get().gold + Number(delta.gold ?? 0);

      // Session row (tileId is intentionally NULL now)
      await run(
        `INSERT INTO sessions (id, createdAt, activity, minutes, note, subtype, amount, tileId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          now,
          activity,
          safeMinutes,
          note ?? null,
          subtype ?? null,
          safeAmount,
          null,
        ],
      );

      // Player update
      await run(
        `UPDATE player
           SET xp = ?, craft = ?, lore = ?, vigor = ?, clarity = ?, gold = ?
         WHERE id = 1;`,
        [nextXp, nextCraft, nextLore, nextVigor, nextClarity, nextGold],
      );

      await run("COMMIT;");

      const newSession: Session = {
        id,
        createdAt: now,
        activity,
        minutes: safeMinutes,
        note: note ?? null,
        subtype: subtype ?? null,
        amount: safeAmount,
      };

      set({
        xp: nextXp,
        craft: nextCraft,
        lore: nextLore,
        vigor: nextVigor,
        clarity: nextClarity,
        gold: nextGold,
        sessions: [newSession, ...get().sessions],
      });

      return { ok: true, tileId: null, unlockedTile: false };
    } catch (e) {
      await run("ROLLBACK;");
      throw e;
    }
  },

  spendResourceOnTile: async (tileId, resource, minutes) => {
    const spend = clampInt(minutes, 1);
    const state = get();
    const pool = Number((state as any)[resource] ?? 0);
    if (pool < spend) {
      return { ok: false, reason: `Not enough ${resource}.` };
    }

    const tiles = state.tiles;
    const index = buildTileIndex(tiles);
    const t = index.byId.get(tileId) ?? null;
    if (!t) return { ok: false, reason: "Unknown tile." };

    if (!canInvest(t, index)) {
      return { ok: false, reason: investabilityReason(t, index) };
    }
    if (t.level >= MAX_LEVEL) {
      return { ok: false, reason: "Tile is already maxed." };
    }

    const activity = ACTIVITY_FOR_RESOURCE[resource];
    if (!isActivityAllowedOnTile(activity, t)) {
      return {
        ok: false,
        reason: "This resource doesn't match the tile's realm.",
      };
    }

    const updated: Tile = applyMinutes(t, spend);
    const unlockedNow = t.level < 1 && updated.level >= 1;
    const gateOpenedNow = t.feature === "gate" && unlockedNow;

    const nextPool = pool - spend;

    await run("BEGIN;");
    try {
      await run(
        `UPDATE tiles SET level = ?, progress = ? WHERE id = ?;`,
        [updated.level, updated.progress, updated.id],
      );
      await run(`UPDATE player SET ${resource} = ? WHERE id = 1;`, [nextPool]);
      if (gateOpenedNow) {
        await applyGateUnlock(run);
      }
      await run("COMMIT;");
    } catch (e) {
      await run("ROLLBACK;");
      throw e;
    }

    let nextTiles = tiles.map((x) => (x.id === updated.id ? updated : x));
    if (gateOpenedNow) {
      nextTiles = nextTiles.map((x) =>
        x.region === "great_depths" ? ({ ...x, locked: 0 as LockedFlag } satisfies Tile) : x,
      );
    }
    set({
      tiles: nextTiles,
      ...({ [resource]: nextPool } as any),
    });

    return { ok: true, unlockedNow };
  },

}));
