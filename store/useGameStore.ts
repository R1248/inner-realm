import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import type { ActivityType, RegionType, Session, Tile } from "../lib/types";

type GameState = {
  isReady: boolean;
  xp: number;
  light: number;
  tiles: Tile[];
  sessions: Session[];

  init: () => Promise<void>;
  addSession: (activity: ActivityType, minutes: number, note?: string) => Promise<void>;
  spendLightUpgradeTile: (tileId: string) => Promise<void>;
};

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

function clampLevel(level: number): number {
  return Math.max(0, Math.min(3, level));
}

export const useGameStore = create<GameState>((set, get) => ({
  isReady: false,
  xp: 0,
  light: 0,
  tiles: [],
  sessions: [],

  init: async () => {
    await initDb();

    // Load player
    const playerRows = await all<{ xp: number; light: number }>(`SELECT xp, light FROM player WHERE id = 1;`);
    const xp = playerRows[0]?.xp ?? 0;
    const light = playerRows[0]?.light ?? 0;

    // Load tiles; if none, create 7x7
    const tileRows = await all<Tile>(`SELECT id, row, col, region, level FROM tiles;`);
    if (tileRows.length === 0) {
      const tiles: Tile[] = [];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          tiles.push({
            id: `${r}-${c}`,
            row: r,
            col: c,
            region: regionForRow(r),
            level: 0,
          });
        }
      }

      // Insert
      for (const t of tiles) {
        await run(
          `INSERT INTO tiles (id, row, col, region, level) VALUES (?, ?, ?, ?, ?);`,
          [t.id, t.row, t.col, t.region, t.level]
        );
      }

      set({ xp, light, tiles, sessions: [], isReady: true });
    } else {
      // Load sessions (latest 200 for MVP)
      const sessions = await all<Session>(
        `SELECT id, createdAt, activity, minutes, note FROM sessions ORDER BY createdAt DESC LIMIT 200;`
      );

      const normalizedTiles = tileRows.map((t: any) => ({
        id: String(t.id),
        row: Number(t.row),
        col: Number(t.col),
        region: t.region as RegionType,
        level: Number(t.level),
      }));

        const normalizedSessions = sessions.map((s: any) => ({
        ...s,
        createdAt: Number(s.createdAt),
        minutes: Number(s.minutes),
        }));

        set({ xp, light, tiles: normalizedTiles, sessions: normalizedSessions, isReady: true });

    }
  },

  addSession: async (activity, minutes, note) => {
    // Rewards (tweak anytime)
    const xpGain = Math.max(1, Math.round(minutes));         // 1 XP per minute
    const lightGain = Math.max(1, Math.round(minutes / 10)); // 1 Light per 10 minutes (min 1)

    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;
    const region = activityToRegion(activity);

    // Insert session
    await run(
      `INSERT INTO sessions (id, createdAt, activity, minutes, note) VALUES (?, ?, ?, ?, ?);`,
      [id, now, activity, minutes, note ?? null]
    );

    // Update player
    const nextXp = get().xp + xpGain;
    const nextLight = get().light + lightGain;
    await run(`UPDATE player SET xp = ?, light = ? WHERE id = 1;`, [nextXp, nextLight]);

    // Auto-upgrade one tile in the activity's region
    const tiles = [...get().tiles];

    // choose the lowest level tile in the region (ties: first)
    const candidates = tiles
      .filter((t) => t.region === region)
      .sort((a, b) => a.level - b.level || a.row - b.row || a.col - b.col);

    if (candidates.length > 0) {
      const target = candidates[0];
      const newLevel = clampLevel(target.level + 1);
      const idx = tiles.findIndex((t) => t.id === target.id);
      tiles[idx] = { ...target, level: newLevel };
      await run(`UPDATE tiles SET level = ? WHERE id = ?;`, [newLevel, target.id]);
    }

    const newSession: Session = {
      id,
      createdAt: now,
      activity,
      minutes,
      note: note ?? null,
    };

    set({
      xp: nextXp,
      light: nextLight,
      tiles,
      sessions: [newSession, ...get().sessions],
    });
  },

  spendLightUpgradeTile: async (tileId) => {
    const cost = 3; // MVP constant cost (tweak later)
    const { light, tiles } = get();
    if (light < cost) return;

    const idx = tiles.findIndex((t) => t.id === tileId);
    if (idx === -1) return;

    const tile = tiles[idx];
    if (tile.level >= 3) return;

    const newLevel = clampLevel(tile.level + 1);
    const nextLight = light - cost;

    await run(`UPDATE tiles SET level = ? WHERE id = ?;`, [newLevel, tileId]);
    await run(`UPDATE player SET light = ? WHERE id = 1;`, [nextLight]);

    const nextTiles = [...tiles];
    nextTiles[idx] = { ...tile, level: newLevel };

    set({ light: nextLight, tiles: nextTiles });
  },
}));
