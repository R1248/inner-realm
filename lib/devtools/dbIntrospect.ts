/**
 * DevTools DB helpers
 *
 * Expected exports from lib/db.ts (per project handoff):
 *  - getAllAsync(sql: string, params?: any[]): Promise<any[]>
 *  - runAsync(sql: string, params?: any[]): Promise<any>
 *  - execAsync(sql: string): Promise<void>
 *
 * If your lib/db.ts uses different names, just adjust these imports.
 */
import { getAllAsync } from "../db";

function quoteIdent(name: string) {
  // SQLite identifier quoting with double quotes
  return `"${String(name).replace(/"/g, '""')}"`;
}

export async function runSqlGetAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await getAllAsync(sql, params)) as any;
}

export async function listUserTables(): Promise<string[]> {
  const rows = await runSqlGetAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => r.name);
}

export async function getTableInfo(table: string) {
  const q = `PRAGMA table_info(${quoteIdent(table)})`;
  return await runSqlGetAll(q);
}

export async function getTableRows(table: string, limit = 50, offset = 0) {
  // NOTE: LIMIT/OFFSET as parameters works in SQLite.
  const q = `SELECT * FROM ${quoteIdent(table)} LIMIT ? OFFSET ?`;
  return await runSqlGetAll(q, [limit, offset]);
}
