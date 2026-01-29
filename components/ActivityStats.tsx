import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ActivityType, Session } from "../lib/types";
import { normalizeActivity } from "../lib/resourceModel";

const activities: { key: ActivityType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "sport", label: "Sport" },
  { key: "mindfulness", label: "Mindfulness" },
];

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

export function ActivityStats(props: { sessions: Session[] }) {
  const { sessions } = props;

  const { totalsByActivity, streaks } = useMemo(() => {
    const totals = new Map<ActivityType, number>();
    const daySets = new Map<ActivityType, Set<string>>();
    const today = dayKey(new Date());

    for (const a of activities) {
      totals.set(a.key, 0);
      daySets.set(a.key, new Set());
    }

    for (const s of sessions) {
      const activity = normalizeActivity(s.activity) as ActivityType;
      if (!daySets.has(activity)) continue;
      const dkey = dayKey(new Date(s.createdAt));
      if (dkey === today) {
        totals.set(activity, (totals.get(activity) ?? 0) + Number(s.minutes ?? 0));
      }
      if (Number(s.minutes ?? 0) > 0) {
        daySets.get(activity)!.add(dkey);
      }
    }

    const streakMap = new Map<ActivityType, number>();
    for (const a of activities) {
      let streak = 0;
      let cursor = today;
      const set = daySets.get(a.key)!;
      while (set.has(cursor)) {
        streak += 1;
        cursor = previousDayKey(cursor);
      }
      streakMap.set(a.key, streak);
    }

    return { totalsByActivity: totals, streaks: streakMap };
  }, [sessions]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>Daily totals and streaks</Text>
      </View>
      <View style={styles.row}>
        {activities.map((a) => (
          <View key={a.key} style={styles.card}>
            <Text style={styles.label}>{a.label}</Text>
            <Text style={styles.value}>{totalsByActivity.get(a.key) ?? 0}m</Text>
            <Text style={styles.hint}>{streaks.get(a.key) ?? 0} day streak</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "white", fontWeight: "900", fontSize: 14 },
  subtitle: { color: "#6b7280", fontSize: 11, fontWeight: "700" },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  card: {
    minWidth: 120,
    flexGrow: 1,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  label: { color: "#9ca3af", fontSize: 11, fontWeight: "800" },
  value: { color: "white", fontSize: 16, fontWeight: "900", marginTop: 6 },
  hint: { color: "#6b7280", fontSize: 11, marginTop: 4 },
});
