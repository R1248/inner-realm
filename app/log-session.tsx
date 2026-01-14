import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import type { ActivityType } from "../lib/types";
import { useGameStore } from "../store/useGameStore";

const activities: { key: ActivityType; label: string; hint: string }[] = [
  { key: "work", label: "Work", hint: "Build the Citadel" },
  { key: "study", label: "Study", hint: "Reinforce Crystal Thought" },
  { key: "meditation", label: "Meditation", hint: "Calm the River" },
  { key: "sport", label: "Sport", hint: "Clear the Wastelands" },
  { key: "habit", label: "Habit", hint: "Stabilize the Realm" },
];

export default function LogSession() {
  const addSession = useGameStore((s) => s.addSession);

  const [activity, setActivity] = useState<ActivityType>("work");
  const [minutesText, setMinutesText] = useState("25");
  const [note, setNote] = useState("");

  const minutes = useMemo(() => {
    const v = Number(minutesText);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.floor(v));
  }, [minutesText]);

  const selected = activities.find((a) => a.key === activity);

  return (
    <View style={styles.screen}>
      <AppHeader title="Log session" subtitle={selected?.hint ?? "Leave a trace."} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.label}>Activity</Text>

        <View style={styles.chips}>
          {activities.map((a) => {
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

        <Text style={[styles.label, { marginTop: 18 }]}>Minutes</Text>
        <TextInput
          value={minutesText}
          onChangeText={setMinutesText}
          keyboardType="number-pad"
          placeholder="e.g. 25"
          placeholderTextColor="#6b7280"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 18 }]}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What did you do?"
          placeholderTextColor="#6b7280"
          style={[styles.input, { height: 96, textAlignVertical: "top" }]}
          multiline
        />

        <Pressable
          style={[styles.primaryBtn, minutes > 0 ? null : styles.primaryBtnDisabled]}
          disabled={minutes <= 0}
          onPress={async () => {
            await addSession(activity, minutes, note.trim() ? note.trim() : undefined);
            router.back();
          }}
        >
          <Text style={styles.primaryBtnText}>Save session</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Saving a session restores one tile automatically and grants Light for cross-fixes.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  label: { color: "#e5e7eb", fontWeight: "800" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { backgroundColor: "#050608", borderColor: "#111827" },
  chipText: { fontWeight: "800" },
  chipTextOn: { color: "#000" },
  chipTextOff: { color: "#e5e7eb" },

  input: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
  },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#374151" },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },

  secondaryBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  secondaryBtnText: { color: "#9ca3af", fontWeight: "800" },

  footnote: { marginTop: 14, color: "#6b7280", fontSize: 12, lineHeight: 16 },
});
