/**
 * Export / Import and resets for DevTools.
 *
 * Expected exports from lib/db.ts (per project handoff):
 *  - getAllAsync(sql: string, params?: any[]): Promise<any[]>
 *  - runAsync(sql: string, params?: any[]): Promise<any>
 *  - execAsync(sql: string): Promise<void>
 *
 * If your lib/db.ts uses different names, adjust the imports.
 */
import { execAsync, getAllAsync, runAsync } from "../db";

type ExportShape = {
  meta: { exportedAt: number; version: number };
  tables: Record<string, any[]>;
};

function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function listTables(): Promise<string[]> {
  const rows = (await getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )) as any[];
  return rows.map((r) => r.name);
}

export async function exportDbJson(): Promise<string> {
  const tables = await listTables();
  const out: ExportShape = {
    meta: { exportedAt: Date.now(), version: 1 },
    tables: {},
  };

  for (const t of tables) {
    if (t.startsWith("sqlite_")) continue;
    const rows = (await getAllAsync(`SELECT * FROM ${quoteIdent(t)}`)) as any[];
    out.tables[t] = rows;
  }

  return JSON.stringify(out, null, 2);
}

export async function resetWorldReseed(): Promise<void> {
  await execAsync("BEGIN TRANSACTION");
  try {
    await execAsync("DELETE FROM tiles");
    await execAsync("DELETE FROM sessions"); // volitelné
    await execAsync("UPDATE player SET xp = 0, targetTileId = NULL");
    await execAsync("COMMIT");
  } catch (e) {
    await execAsync("ROLLBACK");
    throw e;
  }
}

function buildInsert(table: string, row: any) {
  const keys = Object.keys(row);
  const cols = keys.map((k) => quoteIdent(k)).join(", ");
  const qs = keys.map(() => "?").join(", ");
  const sql = `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${qs})`;
  const params = keys.map((k) => row[k]);
  return { sql, params };
}

export async function importDbJson(jsonText: string): Promise<void> {
  let parsed: ExportShape;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!parsed?.tables || typeof parsed.tables !== "object") {
    throw new Error("Missing 'tables' in export");
  }

  const tables = Object.keys(parsed.tables);

  await execAsync("BEGIN TRANSACTION");
  try {
    for (const t of tables) {
      await execAsync(`DELETE FROM ${quoteIdent(t)};`);
      const rows = parsed.tables[t] ?? [];
      for (const row of rows) {
        const { sql, params } = buildInsert(t, row);
        await runAsync(sql, params);
      }
    }
    await execAsync("COMMIT");
  } catch (e) {
    await execAsync("ROLLBACK");
    throw e;
  }
}

export async function resetSessions(): Promise<void> {
  await execAsync("DELETE FROM sessions");
}

export async function resetTiles(): Promise<void> {
  await execAsync("UPDATE tiles SET level = 0, progress = 0");
}

export async function resetPlayer(): Promise<void> {
  await execAsync("UPDATE player SET xp = 0, targetTileId = NULL");
}
