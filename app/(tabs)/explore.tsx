import React, { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import type { ActivityType, Session } from "../../lib/types";
import { useGameStore } from "../../store/useGameStore";

const DAYS = 14;

// base RGB per activity (dark-theme friendly)
const ACTIVITY_RGB: Record<ActivityType, { r: number; g: number; b: number }> = {
  work: { r: 56, g: 189, b: 248 },       // sky
  study: { r: 125, g: 211, b: 252 },     // lighter sky
  meditation: { r: 167, g: 139, b: 250 },// violet
  sport: { r: 245, g: 158, b: 11 },      // amber
  habit: { r: 251, g: 191, b: 36 },      // lighter amber
};

const COLS: { key: ActivityType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "meditation", label: "Medit." },
  { key: "sport", label: "Sport" },
  { key: "habit", label: "Habit" },
];

// how many minutes counts as "full intensity" for coloring
const CELL_TARGET_MIN = 180; // tweak anytime

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function rgbaForMinutes(activity: ActivityType, minutes: number) {
  const { r, g, b } = ACTIVITY_RGB[activity];
  const ratio = clamp01(minutes / CELL_TARGET_MIN);
  const alpha = minutes <= 0 ? 0 : 0.10 + ratio * 0.65; // 0.10..0.75
  return `rgba(${r},${g},${b},${alpha})`;
}

function dayKeyLocal(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDayLabel(key: string) {
  // key: YYYY-MM-DD
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  // simple localized label: "Mon 13/1"
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} ${d}.${m}.`;
}

function makeLastNDaysKeys(n: number) {
  const out: string[] = [];
  const now = new Date();
  // today local midnight
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (let i = 0; i < n; i++) {
    const t = base - i * 24 * 60 * 60 * 1000;
    out.push(dayKeyLocal(t));
  }
  return out; // [today..older]
}

type DayAgg = Record<ActivityType, number> & { total: number };

function emptyAgg(): DayAgg {
  return { work: 0, study: 0, meditation: 0, sport: 0, habit: 0, total: 0 };
}

function addSessionToAgg(a: DayAgg, s: Session) {
  const k = s.activity;
  const mins = Number(s.minutes) || 0;
  a[k] += mins;
  a.total += mins;
}

export default function ProgressScreen() {
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);
  const sessions = useGameStore((s) => s.sessions);

  useEffect(() => {
    // safe to call; store will just ensure DB is ready
    init();
  }, [init]);

  const dayKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);

  const table = useMemo(() => {
    // prefill days so you always see last N rows even if no sessions
    const map = new Map<string, DayAgg>();
    for (const k of dayKeys) map.set(k, emptyAgg());

    for (const s of sessions) {
      const k = dayKeyLocal(s.createdAt);
      if (!map.has(k)) continue; // ignore older than window
      const agg = map.get(k)!;
      addSessionToAgg(agg, s);
    }

    // keep order: today first
    return dayKeys.map((k) => ({ dayKey: k, agg: map.get(k)! }));
  }, [sessions, dayKeys]);

  const today = table[0]?.agg ?? emptyAgg();
  const week = useMemo(() => {
    const w = emptyAgg();
    for (let i = 0; i < Math.min(7, table.length); i++) {
      const a = table[i].agg;
      for (const c of COLS) w[c.key] += a[c.key];
      w.total += a.total;
    }
    return w;
  }, [table]);

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Progress" subtitle="Daily log table (sessions only)." />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Today</Text>
            <Text style={styles.cardValue}>{today.total} min</Text>
            <Text style={styles.cardHint}>Across all categories</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Last 7 days</Text>
            <Text style={styles.cardValue}>{week.total} min</Text>
            <Text style={styles.cardHint}>Sessions only (no boosts)</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {COLS.map((c) => (
            <View key={c.key} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: rgbaForMinutes(c.key, CELL_TARGET_MIN) }]} />
              <Text style={styles.legendText}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Last {DAYS} days</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View style={[styles.tr, styles.trHeader]}>
                <View style={[styles.th, styles.thDate]}>
                  <Text style={styles.thText}>Day</Text>
                </View>
                {COLS.map((c) => (
                  <View key={c.key} style={styles.th}>
                    <Text style={styles.thText}>{c.label}</Text>
                  </View>
                ))}
                <View style={styles.th}>
                  <Text style={styles.thText}>Total</Text>
                </View>
              </View>

              {/* Data rows */}
              {table.map(({ dayKey, agg }) => (
                <View key={dayKey} style={styles.tr}>
                  <View style={[styles.td, styles.tdDate]}>
                    <Text style={styles.tdDateText}>{formatDayLabel(dayKey)}</Text>
                    <Text style={styles.tdDateSub}>{dayKey}</Text>
                  </View>

                  {COLS.map((c) => {
                    const mins = agg[c.key];
                    return (
                      <View
                        key={c.key}
                        style={[
                          styles.td,
                          mins > 0 ? { backgroundColor: rgbaForMinutes(c.key, mins) } : null,
                        ]}
                      >
                        <Text style={styles.tdText}>{mins > 0 ? mins : ""}</Text>
                      </View>
                    );
                  })}

                  <View style={[styles.td, agg.total > 0 ? styles.tdTotalOn : null]}>
                    <Text style={[styles.tdText, { fontWeight: "900" }]}>{agg.total > 0 ? agg.total : ""}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.tableHint}>
            Color intensity scales with minutes (target ≈ {CELL_TARGET_MIN} min per category/day). Adjust anytime.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const COL_W_DATE = 110;
const COL_W = 76;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  row: { flexDirection: "row", gap: 12 },

  card: {
    flex: 1,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardLabel: { color: "#9ca3af", fontSize: 12 },
  cardValue: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 6 },
  cardHint: { color: "#6b7280", fontSize: 12, marginTop: 4 },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: "#111827" },
  legendText: { color: "#9ca3af", fontSize: 12, fontWeight: "800" },

  tableCard: {
    marginTop: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
  },
  tableTitle: { color: "white", fontWeight: "900", fontSize: 14, marginBottom: 10 },
  tableHint: { color: "#6b7280", fontSize: 12, lineHeight: 16, marginTop: 10 },

  tr: { flexDirection: "row" },
  trHeader: { marginBottom: 6 },

  th: {
    width: COL_W,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020305",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  thDate: { width: COL_W_DATE, alignItems: "flex-start" },
  thText: { color: "#9ca3af", fontSize: 12, fontWeight: "900" },

  td: {
    width: COL_W,
    height: 46,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020305",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginBottom: 6,
  },
  tdDate: { width: COL_W_DATE, alignItems: "flex-start" },
  tdDateText: { color: "#e5e7eb", fontWeight: "900", fontSize: 12 },
  tdDateSub: { color: "#6b7280", fontSize: 10, marginTop: 2 },

  tdText: { color: "white", fontSize: 12, fontWeight: "800" },

  tdTotalOn: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
});
