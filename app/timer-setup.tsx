import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { AppHeader } from "../components/AppHeader";
import type { ActivityType, TimerMode } from "../lib/types";
import { useTimerStore } from "../store/useTimerStore";

const ACTIVITIES: { key: ActivityType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "sport", label: "Sport" },
  { key: "mindfulness", label: "Mindfulness" },
];

const DURATIONS: { label: string; minutes: number | null; mode: TimerMode }[] = [
  { label: "25", minutes: 25, mode: "countdown" },
  { label: "45", minutes: 45, mode: "countdown" },
  { label: "60", minutes: 60, mode: "countdown" },
  { label: "8", minutes: null, mode: "countup" },
];

export default function TimerSetupScreen() {
  const startSession = useTimerStore((s) => s.startSession);

  const [activity, setActivity] = useState<ActivityType>("work");
  const [durationIdx, setDurationIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const begin = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const duration = DURATIONS[durationIdx];
      const res = await startSession(activity, duration.mode, duration.minutes);
      if (!res.ok) {
        if (res.session?.status === "running") {
          router.replace("/timer-running");
          return;
        }
        Alert.alert("Timer", res.reason ?? "Could not start session.");
        return;
      }
      router.replace("/timer-running");
    } finally {
      setBusy(false);
    }
  }, [activity, busy, durationIdx, startSession]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Timer session" subtitle="Pick an activity and duration" />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.chips}>
          {ACTIVITIES.map((a) => {
            const isOn = a.key === activity;
            return (
              <Pressable
                key={a.key}
                onPress={() => setActivity(a.key)}
                style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
              >
                <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Duration (minutes)</Text>
        <View style={styles.chips}>
          {DURATIONS.map((d, idx) => {
            const isOn = idx === durationIdx;
            return (
              <Pressable
                key={d.label}
                onPress={() => setDurationIdx(idx)}
                style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
              >
                <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.primaryBtn} onPress={begin} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? "Starting..." : "Begin"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  sectionTitle: { color: "#e5e7eb", fontWeight: "800", fontSize: 12, marginTop: 16 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { backgroundColor: "#020305", borderColor: "#111827" },
  chipText: { fontWeight: "800", fontSize: 12 },
  chipTextOn: { color: "#000" },
  chipTextOff: { color: "#e5e7eb" },

  primaryBtn: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },
});
