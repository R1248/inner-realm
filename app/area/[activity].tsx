import React, { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { AppHeader } from "../../components/AppHeader";
import { ProgressChart } from "../../components/ProgressChart";
import {
  buildDayAggMap,
  formatDayLabel,
  makeLastNDaysKeys,
  streakForActivity,
  sumForActivity,
  trendForActivity,
  type DisplayActivity,
} from "../../lib/progressMetrics";
import { useGameStore } from "../../store/useGameStore";

const DAYS = 14;

const LABELS: Record<DisplayActivity, string> = {
  work: "Work",
  study: "Study",
  meditation: "Meditation",
  sport: "Sport",
};

const COLORS: Record<DisplayActivity, string> = {
  work: "rgb(56,189,248)",
  study: "rgb(125,211,252)",
  meditation: "rgb(167,139,250)",
  sport: "rgb(245,158,11)",
};

function isDisplayActivity(v: string): v is DisplayActivity {
  return v === "work" || v === "study" || v === "meditation" || v === "sport";
}

function trendIcon(trend: "up" | "down" | "flat") {
  if (trend === "up") return "?";
  if (trend === "down") return "?";
  return "?";
}

export default function AreaDetailScreen() {
  const params = useLocalSearchParams();
  const activityParam = String(params.activity ?? "work");
  const activity: DisplayActivity = isDisplayActivity(activityParam) ? activityParam : "work";

  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);
  const sessions = useGameStore((s) => s.sessions);

  useEffect(() => {
    init();
  }, [init]);

  const dayKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);
  const aggMap = useMemo(() => buildDayAggMap(sessions, dayKeys), [sessions, dayKeys]);

  const chartDays = useMemo(() => [...dayKeys].reverse(), [dayKeys]);
  const values = useMemo(() => {
    return chartDays.map((k) => aggMap.get(k)?.[activity] ?? 0);
  }, [aggMap, activity, chartDays]);

  const total = useMemo(() => sumForActivity(aggMap, dayKeys, activity), [aggMap, dayKeys, activity]);
  const streak = useMemo(() => streakForActivity(aggMap, dayKeys, activity), [aggMap, dayKeys, activity]);
  const trend = useMemo(() => trendForActivity(aggMap, dayKeys, activity), [aggMap, dayKeys, activity]);

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}> 
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title={LABELS[activity]} subtitle="Area history" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Last {DAYS} days</Text>
          <Text style={styles.summaryValue}>{total} min</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryMeta}>Streak {streak}d</Text>
            <Text style={styles.summaryMeta}>Trend {trendIcon(trend)}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <ProgressChart values={values} barColor={COLORS[activity]} height={140} />
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>History</Text>
          {dayKeys.map((k) => {
            const mins = aggMap.get(k)?.[activity] ?? 0;
            return (
              <View key={k} style={styles.historyRow}>
                <Text style={styles.historyDate}>{formatDayLabel(k)}</Text>
                <Text style={styles.historyValue}>{mins > 0 ? `${mins} min` : "-"}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  summaryCard: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  summaryLabel: { color: "#9ca3af", fontSize: 12 },
  summaryValue: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 6 },
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  summaryMeta: { color: "#6b7280", fontSize: 12, fontWeight: "700" },

  chartCard: {
    marginTop: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },

  historyCard: {
    marginTop: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  historyTitle: { color: "white", fontWeight: "900", fontSize: 14, marginBottom: 8 },
  historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  historyDate: { color: "#9ca3af", fontSize: 12 },
  historyValue: { color: "#e5e7eb", fontWeight: "800" },
});
