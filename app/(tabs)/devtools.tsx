import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { useGameStore } from "../../store/useGameStore";
import {
  listUserTables,
  getTableInfo,
  getTableRows,
  runSqlGetAll,
} from "../../lib/devtools/dbIntrospect";
import {
  exportDbJson,
  importDbJson,
  resetSessions,
  resetTiles,
  resetPlayer,
} from "../../lib/devtools/dbBackup";

type TableInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
};

export default function DevToolsScreen() {
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const [tableInfo, setTableInfo] = useState<TableInfo[] | null>(null);
  const [tableRows, setTableRows] = useState<any[] | null>(null);
  const [limit, setLimit] = useState(50);

  const [exportText, setExportText] = useState<string>("");
  const [importText, setImportText] = useState<string>("");

  const [stats, setStats] = useState<{ sessions: number; tiles: number; player: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const refreshTables = useCallback(async () => {
    const t = await listUserTables();
    setTables(t);
    if (!selectedTable && t.length > 0) setSelectedTable(t[0]);
  }, [selectedTable]);

  const refreshStats = useCallback(async () => {
    try {
      const s = await runSqlGetAll<{ c: number }>("SELECT COUNT(*) as c FROM sessions");
      const t = await runSqlGetAll<{ c: number }>("SELECT COUNT(*) as c FROM tiles");
      const p = await runSqlGetAll<{ c: number }>("SELECT COUNT(*) as c FROM player");
      setStats({
        sessions: s?.[0]?.c ?? 0,
        tiles: t?.[0]?.c ?? 0,
        player: p?.[0]?.c ?? 0,
      });
    } catch {
      setStats(null);
    }
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedTable) return;
    const info = await getTableInfo(selectedTable);
    const rows = await getTableRows(selectedTable, limit, 0);
    setTableInfo(info);
    setTableRows(rows);
  }, [selectedTable, limit]);

  const refreshAll = useCallback(async () => {
    await refreshTables();
    await refreshStats();
    await refreshSelected();
  }, [refreshTables, refreshStats, refreshSelected]);

  useEffect(() => {
    if (!isReady) return;
    refreshAll();
  }, [isReady, refreshAll]);

  useEffect(() => {
    if (!isReady) return;
    refreshSelected();
  }, [isReady, selectedTable, limit, refreshSelected]);

  const prettyRow = useCallback((row: any) => {
    try {
      return JSON.stringify(row, null, 2);
    } catch {
      return String(row);
    }
  }, []);

  const tableCols = useMemo(() => {
    if (!tableInfo) return [];
    return tableInfo.map((c) => c.name);
  }, [tableInfo]);

  const doExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportDbJson();
      setExportText(json);
      await Share.share({ message: json });
    } catch (e: any) {
      Alert.alert("Export failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, []);

  const doImport = useCallback(async () => {
    if (!importText.trim()) return;
    Alert.alert(
      "Import DB",
      "This will overwrite your local DB tables with the pasted JSON. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await importDbJson(importText);
              await init();
              await refreshAll();
              Alert.alert("Imported", "DB import completed.");
            } catch (e: any) {
              Alert.alert("Import failed", String(e?.message ?? e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [importText, init, refreshAll]);

  const confirm = useCallback(
    (title: string, msg: string, action: () => Promise<void>) => {
      Alert.alert(title, msg, [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await action();
              await init();
              await refreshAll();
            } catch (e: any) {
              Alert.alert("Operation failed", String(e?.message ?? e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [init, refreshAll]
  );

  const doResetSessions = useCallback(() => {
    confirm("Reset sessions", "Delete ALL sessions rows?", resetSessions);
  }, [confirm]);

  const doResetTiles = useCallback(() => {
    confirm("Reset tiles", "Set all tiles to level=0 and progress=0?", resetTiles);
  }, [confirm]);

  const doResetPlayer = useCallback(() => {
    confirm("Reset player", "Set player xp/light/targetTileId back to defaults?", resetPlayer);
  }, [confirm]);

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Dev Tools" subtitle="DB viewer • reset • export/import" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
        <View style={styles.section}>
          <Text style={styles.h2}>Quick stats</Text>
          <Text style={styles.mono}>
            sessions: {stats?.sessions ?? "—"} • tiles: {stats?.tiles ?? "—"} • player:{" "}
            {stats?.player ?? "—"}
          </Text>

          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={refreshAll} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Working…" : "Refresh"}</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={doExport} disabled={busy}>
              <Text style={styles.btnText}>Export → Share</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Reset</Text>
          <Text style={styles.note}>
            These actions modify your local SQLite DB. Use export first if you want a backup.
          </Text>

          <View style={styles.rowWrap}>
            <Pressable style={[styles.btn, styles.danger]} onPress={doResetSessions} disabled={busy}>
              <Text style={styles.btnText}>Reset sessions</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.danger]} onPress={doResetTiles} disabled={busy}>
              <Text style={styles.btnText}>Reset tiles</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.danger]} onPress={doResetPlayer} disabled={busy}>
              <Text style={styles.btnText}>Reset player</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Import</Text>
          <Text style={styles.note}>
            Paste JSON exported from this screen. Import overwrites tables (player/tiles/sessions).
          </Text>

          <TextInput
            value={importText}
            onChangeText={setImportText}
            placeholder="Paste exported JSON here…"
            placeholderTextColor="#6b7280"
            multiline
            style={styles.textarea}
          />

          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.danger]} onPress={doImport} disabled={busy}>
              <Text style={styles.btnText}>Import (overwrite)</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={() => setImportText("")} disabled={busy}>
              <Text style={styles.btnText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>DB viewer</Text>
          <Text style={styles.note}>Tap a table, then inspect first N rows.</Text>

          <View style={styles.tableChips}>
            {tables.map((t) => (
              <Pressable
                key={t}
                onPress={() => setSelectedTable(t)}
                style={[styles.chip, selectedTable === t && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedTable === t && styles.chipTextActive]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Limit</Text>
            <TextInput
              value={String(limit)}
              onChangeText={(v) =>
                setLimit(Math.max(1, Math.min(500, parseInt(v || "50", 10) || 50)))
              }
              keyboardType="number-pad"
              style={styles.limitInput}
            />
            <Pressable style={styles.btnSmall} onPress={refreshSelected} disabled={busy}>
              <Text style={styles.btnText}>Load</Text>
            </Pressable>
          </View>

          <Text style={styles.mono}>
            {selectedTable ? `Columns: ${tableCols.join(", ") || "—"}` : "No table selected"}
          </Text>

          <View style={{ gap: 10, marginTop: 10 }}>
            {(tableRows ?? []).map((r, idx) => (
              <View key={idx} style={styles.rowCard}>
                <Text style={styles.rowTitle}>
                  #{idx + 1} {selectedTable}
                </Text>
                <Text style={styles.rowJson}>{prettyRow(r)}</Text>
              </View>
            ))}
            {!tableRows?.length ? <Text style={styles.note}>No rows (or table not loaded).</Text> : null}
          </View>
        </View>

        {!!exportText && (
          <View style={styles.section}>
            <Text style={styles.h2}>Last export (for copy)</Text>
            <TextInput value={exportText} editable={false} multiline style={styles.textarea} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b0f15" },

  section: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0f1520",
  },

  h2: { color: "#e5e7eb", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  label: { color: "#9ca3af", fontWeight: "700" },
  note: { color: "#9ca3af", fontSize: 12, lineHeight: 16 },

  mono: {
    color: "#cbd5e1",
    fontFamily: "monospace",
    fontSize: 12,
    marginTop: 6,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },

  btn: {
    flexGrow: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
  },
  btnSmall: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
  },
  danger: { backgroundColor: "#2a1111", borderColor: "#7f1d1d" },
  btnText: { color: "#e5e7eb", fontWeight: "800" },

  textarea: {
    marginTop: 10,
    minHeight: 120,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b1220",
    color: "#e5e7eb",
    fontFamily: "monospace",
  },

  tableChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b1220",
  },
  chipActive: { borderColor: "#38bdf8", backgroundColor: "#082033" },
  chipText: { color: "#cbd5e1", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#e5e7eb" },

  limitInput: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b1220",
    color: "#e5e7eb",
    fontFamily: "monospace",
  },

  rowCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b1220",
    padding: 10,
  },
  rowTitle: { color: "#93c5fd", fontWeight: "800", marginBottom: 6 },
  rowJson: { color: "#e5e7eb", fontFamily: "monospace", fontSize: 12, lineHeight: 16 },
});