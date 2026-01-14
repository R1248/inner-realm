import * as SQLite from "expo-sqlite";

const DB_NAME = "inner_realm.db";

// New expo-sqlite API (no transaction/executeSql)
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
  // Use execAsync for schema (supports multiple statements if needed)
  await exec(`
    CREATE TABLE IF NOT EXISTS player (
      id INTEGER PRIMARY KEY NOT NULL,
      xp INTEGER NOT NULL,
      light INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tiles (
      id TEXT PRIMARY KEY NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      region TEXT NOT NULL,
      level INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      createdAt INTEGER NOT NULL,
      activity TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      note TEXT
    );
  `);

  const players = await all<{ id: number }>(`SELECT id FROM player WHERE id = 1;`);
  if (players.length === 0) {
    await run(`INSERT INTO player (id, xp, light) VALUES (1, 0, 0);`);
  }
}
