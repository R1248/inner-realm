import { create } from "zustand";
import { all, initDb, run } from "../lib/db";
import type { ActivityType, TimerMode, TimerSession } from "../lib/types";
import { useGameStore } from "./useGameStore";

function normalizeSession(row: any): TimerSession {
  return {
    id: String(row.id),
    activity: row.activity as ActivityType,
    mode: row.mode as TimerMode,
    startedAt: Number(row.startedAt),
    endsAt: row.endsAt == null ? null : Number(row.endsAt),
    stoppedAt: row.stoppedAt == null ? null : Number(row.stoppedAt),
    status: row.status as TimerSession["status"],
  };
}

async function fetchActiveSession(): Promise<TimerSession | null> {
  const runningRows = await all<any>(
    `SELECT id, activity, mode, startedAt, endsAt, stoppedAt, status
     FROM timer_sessions
     WHERE status = 'running'
     ORDER BY startedAt DESC
     LIMIT 1;`,
  );
  if (runningRows.length > 0) return normalizeSession(runningRows[0]);

  const stoppedRows = await all<any>(
    `SELECT id, activity, mode, startedAt, endsAt, stoppedAt, status
     FROM timer_sessions
     WHERE status = 'stopped'
     ORDER BY stoppedAt DESC
     LIMIT 1;`,
  );
  if (stoppedRows.length > 0) return normalizeSession(stoppedRows[0]);

  return null;
}

type TimerState = {
  isReady: boolean;
  activeSession: TimerSession | null;

  init: () => Promise<void>;
  refreshActiveSession: () => Promise<TimerSession | null>;

  startSession: (
    activity: ActivityType,
    mode: TimerMode,
    durationMinutes?: number | null,
  ) => Promise<
    | { ok: true; session: TimerSession }
    | { ok: false; reason: string; session?: TimerSession }
  >;

  stopSession: () => Promise<TimerSession | null>;
  resumeSession: () => Promise<TimerSession | null>;
  discardSession: () => Promise<void>;
  commitSession: () => Promise<
    | { ok: true; sessionId: string; minutes: number }
    | { ok: false; reason: string }
  >;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  isReady: false,
  activeSession: null,

  init: async () => {
    await initDb();
    const active = await fetchActiveSession();
    set({ isReady: true, activeSession: active });
  },

  refreshActiveSession: async () => {
    if (!get().isReady) await get().init();
    const active = await fetchActiveSession();
    set({ activeSession: active });
    return active;
  },

  startSession: async (activity, mode, durationMinutes) => {
    if (!get().isReady) await get().init();

    const existing = await all<any>(
      `SELECT id, activity, mode, startedAt, endsAt, stoppedAt, status
       FROM timer_sessions
       WHERE status = 'running'
       ORDER BY startedAt DESC
       LIMIT 1;`,
    );
    if (existing.length > 0) {
      const running = normalizeSession(existing[0]);
      set({ activeSession: running });
      return {
        ok: false,
        reason: "A timer session is already running.",
        session: running,
      };
    }

    const now = Date.now();
    const id = `${now}-${Math.random().toString(16).slice(2)}`;
    const endsAt =
      mode === "countdown" && durationMinutes
        ? now + Math.max(1, Math.floor(durationMinutes)) * 60 * 1000
        : null;

    await run(
      `INSERT INTO timer_sessions (id, activity, mode, startedAt, endsAt, stoppedAt, status)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, activity, mode, now, endsAt, null, "running"],
    );

    const session: TimerSession = {
      id,
      activity,
      mode,
      startedAt: now,
      endsAt,
      stoppedAt: null,
      status: "running",
    };

    set({ activeSession: session });
    return { ok: true, session };
  },

  stopSession: async () => {
    const current = get().activeSession;
    if (!current || current.status !== "running") return current ?? null;

    const stoppedAt = Date.now();
    await run(`UPDATE timer_sessions SET status = 'stopped', stoppedAt = ? WHERE id = ?;`, [
      stoppedAt,
      current.id,
    ]);

    const next: TimerSession = { ...current, status: "stopped", stoppedAt };
    set({ activeSession: next });
    return next;
  },

  resumeSession: async () => {
    const current = get().activeSession;
    if (!current || current.status !== "stopped") return current ?? null;

    await run(`UPDATE timer_sessions SET status = 'running', stoppedAt = NULL WHERE id = ?;`, [
      current.id,
    ]);

    const next: TimerSession = { ...current, status: "running", stoppedAt: null };
    set({ activeSession: next });
    return next;
  },

  discardSession: async () => {
    const current = get().activeSession;
    if (!current) return;

    await run(`DELETE FROM timer_sessions WHERE id = ?;`, [current.id]);
    set({ activeSession: null });
  },

  commitSession: async () => {
    const current = get().activeSession;
    if (!current) return { ok: false, reason: "No session to commit." };

    const stoppedAt = current.stoppedAt ?? Date.now();
    const durationMs = Math.max(0, stoppedAt - current.startedAt);
    const minutes = Math.max(1, Math.round(durationMs / 60000));

    await run(`UPDATE timer_sessions SET status = 'committed', stoppedAt = ? WHERE id = ?;`, [
      stoppedAt,
      current.id,
    ]);

    set({ activeSession: null });

    const game = useGameStore.getState();
    if (!game.isReady) {
      await game.init();
    }

    void game.addSession(current.activity, minutes).catch(() => {
      // silent in alpha
    });

    return { ok: true, sessionId: current.id, minutes };
  },
}));
