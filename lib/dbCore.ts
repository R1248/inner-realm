import * as SQLite from "expo-sqlite";

const DB_NAME = "inner_realm.db";

// New expo-sqlite API (SDK 50+): openDatabaseAsync + execAsync/runAsync/getAllAsync
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
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

// Backwards compat aliases (if you use these somewhere)
export { exec as execAsync, all as getAllAsync, run as runAsync };
export type { SQLite };

