import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "../../components/AppHeader";
import { ProgressChart } from "../../components/ProgressChart";
import {
  buildDayAggMap,
  formatDayLabel,
  makeLastNDaysKeys,
  streakForActivity,
  sumForActivity,
  trendForActivity,
  type DayAgg,
  type DisplayActivity,
} from "../../lib/progressMetrics";
import { useGameStore } from "../../store/useGameStore";

const DAYS = 14;

// base RGB per activity (dark-theme friendly)
const ACTIVITY_RGB: Record<DisplayActivity, { r: number; g: number; b: number }> = {
  work: { r: 56, g: 189, b: 248 },       // sky
  study: { r: 125, g: 211, b: 252 },     // lighter sky
  meditation: { r: 167, g: 139, b: 250 },// violet
  sport: { r: 245, g: 158, b: 11 },      // amber
};

const COLS: { key: DisplayActivity; label: string }[] = [
  { key: "work", label: "🛠️" },
  { key: "study", label: "📚" },
  { key: "meditation", label: "🧘" },
  { key: "sport", label: "🏃" },
];

const CHART_OPTIONS: { key: DisplayActivity | "total"; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "work", label: "🛠️" },
  { key: "study", label: "📚" },
  { key: "meditation", label: "🧘" },
  { key: "sport", label: "🏃" },
];

// how many minutes counts as "full intensity" for coloring
const CELL_TARGET_MIN = 180; // tweak anytime

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function rgbaForMinutes(activity: DisplayActivity, minutes: number) {
  const { r, g, b } = ACTIVITY_RGB[activity];
  const ratio = clamp01(minutes / CELL_TARGET_MIN);
  const alpha = minutes <= 0 ? 0 : 0.10 + ratio * 0.65; // 0.10..0.75
  return `rgba(${r},${g},${b},${alpha})`;
}

const COL_W_DATE = 86;
const COL_W = 58;

const LEVEL_STEP = 300; // minutes per level

function levelForMinutes(total: number) {
  const lvl = Math.max(1, Math.floor(total / LEVEL_STEP) + 1);
  const within = total % LEVEL_STEP;
  const ratio = within / LEVEL_STEP;
  return { level: lvl, ratio };
}

function trendIcon(trend: "up" | "down" | "flat") {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

export default function ProgressScreen() {
  const router = useRouter();
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);
  const sessions = useGameStore((s) => s.sessions);

  useEffect(() => {
    init();
  }, [init]);

  const dayKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);

  const aggMap = useMemo(() => buildDayAggMap(sessions, dayKeys), [sessions, dayKeys]);

  const table = useMemo(() => {
    return dayKeys.map((k) => ({ dayKey: k, agg: aggMap.get(k)! }));
  }, [aggMap, dayKeys]);

  const today = table[0]?.agg ?? ({ total: 0 } as DayAgg);
  const week = useMemo(() => {
    const total = sumForActivity(aggMap, dayKeys.slice(0, 7), "total");
    return { total };
  }, [aggMap, dayKeys]);

  const areas = useMemo(() => {
    return COLS.map((c) => {
      const total = sumForActivity(aggMap, dayKeys, c.key);
      const { level, ratio } = levelForMinutes(total);
      const streak = streakForActivity(aggMap, dayKeys, c.key);
      const trend = trendForActivity(aggMap, dayKeys, c.key);
      return { key: c.key, label: c.label, total, level, ratio, streak, trend };
    });
  }, [aggMap, dayKeys]);

  const [chartKey, setChartKey] = useState<DisplayActivity | "total">("total");

  const chartDays = useMemo(() => [...dayKeys].reverse(), [dayKeys]);
  const chartValues = useMemo(() => {
    return chartDays.map((k) => {
      const agg = aggMap.get(k);
      if (!agg) return 0;
      return chartKey === "total" ? agg.total : agg[chartKey];
    });
  }, [aggMap, chartDays, chartKey]);

  const chartColor = chartKey === "total"
    ? "rgba(255,255,255,0.7)"
    : `rgb(${ACTIVITY_RGB[chartKey].r},${ACTIVITY_RGB[chartKey].g},${ACTIVITY_RGB[chartKey].b})`;

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading...</Text>
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

        <Text style={styles.sectionTitle}>Oblasti rozvoje</Text>
        <View style={styles.areaGrid}>
          {areas.map((a) => (
            <Pressable
              key={a.key}
              style={styles.areaCard}
              onPress={() => router.push(`/area/${a.key}`)}
            >
              <View style={styles.areaHeader}>
                <Text style={styles.areaTitle}>{a.label}</Text>
                <View style={styles.levelChip}>
                  <Text style={styles.levelText}>Lv {a.level}</Text>
                </View>
              </View>

              <View style={styles.areaBarTrack}>
                <View style={[styles.areaBarFill, { width: `${Math.round(a.ratio * 100)}%` }]} />
              </View>

              <View style={styles.areaFooter}>
                <View style={styles.streakChip}>
                  <Text style={styles.streakText}>Streak {a.streak}d</Text>
                </View>
                <Text style={styles.trend}>{trendIcon(a.trend)}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Graf 14 dnů</Text>
        <View style={styles.chartCard}>
          <View style={styles.chipsRow}>
            {CHART_OPTIONS.map((opt) => {
              const isOn = opt.key === chartKey;
              return (
                <Pressable
                  key={String(opt.key)}
                  onPress={() => setChartKey(opt.key)}
                  style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ProgressChart values={chartValues} barColor={chartColor} height={120} />
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

  sectionTitle: { marginTop: 18, color: "#e5e7eb", fontSize: 12, fontWeight: "900" },

  areaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  areaCard: {
    width: "48%",
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  areaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  areaTitle: { color: "white", fontSize: 16, fontWeight: "900" },
  levelChip: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelText: { color: "#e5e7eb", fontSize: 11, fontWeight: "800" },
  areaBarTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  areaBarFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.8)" },
  areaFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  streakChip: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakText: { color: "#9ca3af", fontSize: 10, fontWeight: "800" },
  trend: { color: "#e5e7eb", fontSize: 14, fontWeight: "900" },

  chartCard: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { backgroundColor: "#020305", borderColor: "#111827" },
  chipText: { fontWeight: "800", fontSize: 11 },
  chipTextOn: { color: "#000" },
  chipTextOff: { color: "#e5e7eb" },

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
