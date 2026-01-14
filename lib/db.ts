import * as SQLite from "expo-sqlite";

const DB_NAME = "inner_realm.db";

// New expo-sqlite API (SDK 50+): openDatabaseAsync + execAsync/runAsync/getAllAsync
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

export async function exec(sql: string): Promise<void> {
  const db = await getDb();
  await db.execAsync(sql);
}

export async function run(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<void> {
  const db = await getDb();
  await db.runAsync(sql, params);
}

export async function all<T = any>(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<T[]> {
  const db = await getDb();
  return (await db.getAllAsync(sql, params)) as T[];
}

export async function initDb(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS player (
      id INTEGER PRIMARY KEY NOT NULL,
      xp INTEGER NOT NULL,
      light INTEGER NOT NULL,
      targetTileId TEXT
    );

    CREATE TABLE IF NOT EXISTS tiles (
      id TEXT PRIMARY KEY NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      region TEXT NOT NULL,
      level INTEGER NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      createdAt INTEGER NOT NULL,
      activity TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      note TEXT
    );
  `);

  // 1) MIGRATIONS first (so columns exist on older DBs)
  try { await run(`ALTER TABLE tiles ADD COLUMN progress INTEGER DEFAULT 0;`); } catch {}
  try { await run(`ALTER TABLE player ADD COLUMN targetTileId TEXT;`); } catch {}

  // 2) Ensure non-null progress
  await run(`UPDATE tiles SET progress = 0 WHERE progress IS NULL;`);

  // 3) Legacy repair (NOW safe)
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
  const players = await all<{ id: number }>(`SELECT id FROM player WHERE id = 1;`);
  if (players.length === 0) {
    await run(`INSERT INTO player (id, xp, light, targetTileId) VALUES (1, 0, 0, NULL);`);
  }
}

