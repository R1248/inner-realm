import { all, exec, run } from "./dbCore";
import { seedInnerRealmIfEmpty } from "./world/seedInnerRealm";
import { syncInnerRealmToLayout } from "./world/syncInnerRealm";

export async function initDb(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS player (
      id INTEGER PRIMARY KEY NOT NULL,
      xp INTEGER NOT NULL,
      light INTEGER NOT NULL,
      craft INTEGER NOT NULL DEFAULT 0,
      lore INTEGER NOT NULL DEFAULT 0,
      vigor INTEGER NOT NULL DEFAULT 0,
      clarity INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      targetTileId TEXT
    );

    CREATE TABLE IF NOT EXISTS tiles (
      id TEXT PRIMARY KEY NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      region TEXT NOT NULL,
      level INTEGER NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      feature TEXT,
      locked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      createdAt INTEGER NOT NULL,
      activity TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      note TEXT,
      subtype TEXT,
      amount INTEGER,
      tileId TEXT
    );

    CREATE TABLE IF NOT EXISTS timer_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      activity TEXT NOT NULL,
      mode TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      endsAt INTEGER,
      stoppedAt INTEGER,
      status TEXT NOT NULL
    );
  `);

  // 1) MIGRATIONS first (so columns exist on older DBs)
  // tiles
  try {
    await run(`ALTER TABLE tiles ADD COLUMN progress INTEGER DEFAULT 0;`);
  } catch {}
  try {
    await run(`ALTER TABLE tiles ADD COLUMN feature TEXT;`);
  } catch {}
  try {
    await run(
      `ALTER TABLE tiles ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;`,
    );
  } catch {}

  // player
  try {
    await run(`ALTER TABLE player ADD COLUMN targetTileId TEXT;`);
  } catch {}
  for (const col of ["craft", "lore", "vigor", "clarity", "gold"] as const) {
    try {
      await run(
        `ALTER TABLE player ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0;`,
      );
    } catch {}
  }

  // sessions
  for (const [, ddl] of [
    ["subtype", `ALTER TABLE sessions ADD COLUMN subtype TEXT;`],
    ["amount", `ALTER TABLE sessions ADD COLUMN amount INTEGER;`],
    ["tileId", `ALTER TABLE sessions ADD COLUMN tileId TEXT;`],
  ] as const) {
    try {
      await run(ddl);
    } catch {}
  }

  // timer_sessions
  for (const ddl of [
    `ALTER TABLE timer_sessions ADD COLUMN activity TEXT;`,
    `ALTER TABLE timer_sessions ADD COLUMN mode TEXT;`,
    `ALTER TABLE timer_sessions ADD COLUMN startedAt INTEGER;`,
    `ALTER TABLE timer_sessions ADD COLUMN endsAt INTEGER;`,
    `ALTER TABLE timer_sessions ADD COLUMN stoppedAt INTEGER;`,
    `ALTER TABLE timer_sessions ADD COLUMN status TEXT;`,
  ] as const) {
    try {
      await run(ddl);
    } catch {}
  }

  // 2) Ensure non-null defaults
  await run(`UPDATE tiles SET progress = 0 WHERE progress IS NULL;`);
  await run(`UPDATE tiles SET locked = 0 WHERE locked IS NULL;`);
  await run(`UPDATE tiles SET feature = NULL WHERE feature IS NULL;`);

  // 3) Legacy repair
  await run(`
    UPDATE tiles
    SET progress =
      CASE
        WHEN level <= 0 THEN 0
        WHEN level = 1 THEN 60
        WHEN level = 2 THEN 180
        ELSE 360
      END
    WHERE progress = 0 AND level > 0;
  `);

  await run(`
    UPDATE tiles
    SET level =
      CASE
        WHEN progress >= 360 THEN 3
        WHEN progress >= 180 THEN 2
        WHEN progress >= 60 THEN 1
        ELSE 0
      END;
  `);

  // 4) Ensure player row exists
  const players = await all<{ id: number }>(
    `SELECT id FROM player WHERE id = 1;`,
  );
  if (players.length === 0) {
    await run(
      `INSERT INTO player (id, xp, light, craft, lore, vigor, clarity, gold, targetTileId)
       VALUES (1, 0, 0, 0, 0, 0, 0, 0, NULL);`,
    );
  }

  // 5) Ensure player resource cols are non-null (older DBs)
  await run(`UPDATE player SET craft = 0 WHERE craft IS NULL;`);
  await run(`UPDATE player SET lore = 0 WHERE lore IS NULL;`);
  await run(`UPDATE player SET vigor = 0 WHERE vigor IS NULL;`);
  await run(`UPDATE player SET clarity = 0 WHERE clarity IS NULL;`);
  await run(`UPDATE player SET gold = 0 WHERE gold IS NULL;`);

  // 6) Legacy region ids (pre multi-region)
  await run(
    `UPDATE tiles SET region = 'wastelands_ash_dust' WHERE region = 'wastelands';`,
  );
  await run(
    `UPDATE tiles SET region = 'river_despair' WHERE region = 'river';`,
  );
  await run(
    `UPDATE tiles SET region = 'crystal_citadel' WHERE region = 'citadel';`,
  );

  // 7) Seed & sync
  await seedInnerRealmIfEmpty();
  await syncInnerRealmToLayout();
}

// Re-export low-level helpers for the rest of the app (keeps old imports working)
export {
  all,
  exec,
  exec as execAsync,
  all as getAllAsync,
  run,
  run as runAsync
} from "./dbCore";
