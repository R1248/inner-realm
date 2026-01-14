import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import type { ActivityType, Tile } from "../lib/types";
import { useGameStore } from "../store/useGameStore";

const activities: { key: ActivityType; label: string; hint: string }[] = [
  { key: "work", label: "Work", hint: "Build the Citadel" },
  { key: "study", label: "Study", hint: "Reinforce Crystal Thought" },
  { key: "meditation", label: "Meditation", hint: "Calm the River" },
  { key: "sport", label: "Sport", hint: "Clear the Wastelands" },
  { key: "habit", label: "Habit", hint: "Stabilize the Realm" },
];

function regionLabel(region: Tile["region"]) {
  if (region === "citadel") return "Citadel";
  if (region === "river") return "River";
  return "Wastelands";
}

function allowedActivitiesForRegion(region: Tile["region"]): ActivityType[] {
  if (region === "citadel") return ["work", "study"];
  if (region === "river") return ["meditation"];
  return ["sport", "habit"];
}

export default function LogSession() {
  const params = useLocalSearchParams<{ tileId?: string }>();
  const forcedTileId = typeof params.tileId === "string" ? params.tileId : null;

  const addSession = useGameStore((s) => s.addSession);
  const tiles = useGameStore((s) => s.tiles);

  const targetTileId = useGameStore((s) => s.targetTileId);
  const setTargetTile = useGameStore((s) => s.setTargetTile);

  const forcedTile = useMemo(() => {
    if (!forcedTileId) return null;
    return tiles.find((t) => t.id === forcedTileId) ?? null;
  }, [tiles, forcedTileId]);

  const targetTile = useMemo(() => {
    if (!targetTileId) return null;
    return tiles.find((t) => t.id === targetTileId) ?? null;
  }, [tiles, targetTileId]);

  const lockedTile = forcedTile ?? targetTile;
  const lockedRegion = lockedTile?.region ?? null;

  const allowed = useMemo(() => {
    if (!lockedRegion) return activities.map((a) => a.key);
    return allowedActivitiesForRegion(lockedRegion);
  }, [lockedRegion]);

  const [activity, setActivity] = useState<ActivityType>("work");
  const [minutesText, setMinutesText] = useState("25");
  const [note, setNote] = useState("");

  useEffect(() => {
    // ensure activity is valid under lock
    if (allowed.includes(activity)) return;
    setActivity(allowed[0] ?? "work");
  }, [allowed, activity]);

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
        <View style={styles.lockCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lockLabel}>Investing into</Text>
            <Text style={styles.lockValue}>
              {lockedTile
                ? `${regionLabel(lockedTile.region)} (${lockedTile.row}, ${lockedTile.col})`
                : "Auto-pick by activity region"}
            </Text>
            <Text style={styles.lockHint}>
              {forcedTile
                ? "This is a one-time lock (log into this tile). Activities are restricted to its region."
                : targetTile
                ? "Target tile lock is active. Activities are restricted to its region."
                : "No tile lock. Your minutes go into a tile based on activity region."}
            </Text>
          </View>

          {!forcedTile && targetTile ? (
            <Pressable
              onPress={async () => {
                await setTargetTile(null);
              }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>Activity</Text>

        <View style={styles.chips}>
          {activities
            .filter((a) => allowed.includes(a.key))
            .map((a) => {
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
            const cleanNote = note.trim() ? note.trim() : undefined;
            await addSession(activity, minutes, cleanNote, forcedTileId ?? undefined);
            router.back();
          }}
        >
          <Text style={styles.primaryBtnText}>Save session</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Sessions add XP + Light and invest minutes into the locked tile (if any). Light boosts add minutes to tiles
          but do not create sessions.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  lockCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  lockLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "800" },
  lockValue: { color: "white", fontSize: 14, fontWeight: "900", marginTop: 6 },
  lockHint: { color: "#6b7280", fontSize: 12, lineHeight: 16, marginTop: 6 },

  clearBtn: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearBtnText: { color: "#e5e7eb", fontWeight: "900" },

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
