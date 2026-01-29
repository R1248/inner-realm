import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActivityType, SportSubtype } from "../lib/types";
import { useGameStore } from "../store/useGameStore";

const activities: { key: ActivityType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "sport", label: "Sport" },
  { key: "income", label: "Income" },
];

const sportSubtypes: { key: SportSubtype; label: string }[] = [
  { key: "run", label: "Run" },
  { key: "strength", label: "Strength" },
  { key: "swim", label: "Swim" },
  { key: "bike", label: "Bike" },
  { key: "team", label: "Team" },
  { key: "other", label: "Other" },
];

export function QuickLogCard() {
  const addSession = useGameStore((s) => s.addSession);
  const [activity, setActivity] = useState<ActivityType>("work");
  const [sportSubtype, setSportSubtype] = useState<SportSubtype>("run");
  const [minutesText, setMinutesText] = useState("25");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const minutes = useMemo(() => {
    const v = Number(minutesText);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.floor(v));
  }, [minutesText]);

  const isIncome = activity === "income";
  const isSport = activity === "sport";
  const amount = useMemo(() => {
    const v = Number(amountText);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.floor(v));
  }, [amountText]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Quick log</Text>
        <Text style={styles.subtitle}>Manual session entry</Text>
      </View>

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

      {!isIncome ? (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Minutes</Text>
          <TextInput
            value={minutesText}
            onChangeText={setMinutesText}
            keyboardType="number-pad"
            placeholder="e.g. 25"
            placeholderTextColor="#6b7280"
            style={styles.input}
          />
        </>
      ) : (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Amount</Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder="e.g. 1000"
            placeholderTextColor="#6b7280"
            style={styles.input}
          />
          <Text style={styles.amountHint}>Stored as an integer. Currency is up to you for now.</Text>
        </>
      )}

      {isSport ? (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>Sport subtype</Text>
          <View style={styles.chips}>
            {sportSubtypes.map((s) => {
              const isOn = s.key === sportSubtype;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSportSubtype(s.key)}
                  style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.label, { marginTop: 12 }]}>Note (optional)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What did you do?"
        placeholderTextColor="#6b7280"
        style={[styles.input, { height: 72, textAlignVertical: "top" }]}
        multiline
      />

      <Pressable
        style={[
          styles.primaryBtn,
          (isIncome ? amount > 0 : minutes > 0) ? null : styles.primaryBtnDisabled,
        ]}
        disabled={isIncome ? amount <= 0 : minutes <= 0}
        onPress={async () => {
          setError(null);
          setSuccess(null);
          const cleanNote = note.trim() ? note.trim() : undefined;
          const res = await addSession(
            activity,
            isIncome ? 0 : minutes,
            isSport ? sportSubtype : undefined,
            isIncome ? amount : undefined,
            cleanNote,
          );
          if (!res.ok) {
            setError(res.reason);
            return;
          }
          setSuccess("Session saved.");
        }}
      >
        <Text style={styles.primaryBtnText}>Save session</Text>
      </Pressable>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Cannot save</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {success ? <Text style={styles.success}>{success}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "white", fontSize: 14, fontWeight: "900" },
  subtitle: { color: "#6b7280", fontSize: 11, fontWeight: "700" },

  label: { color: "#e5e7eb", fontWeight: "800" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { backgroundColor: "#020305", borderColor: "#111827" },
  chipText: { fontWeight: "800", fontSize: 12 },
  chipTextOn: { color: "#000" },
  chipTextOff: { color: "#e5e7eb" },

  input: {
    marginTop: 8,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
  },
  amountHint: { color: "#6b7280", fontSize: 11, lineHeight: 16, marginTop: 6 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#374151" },
  primaryBtnText: { color: "#000", fontSize: 14, fontWeight: "900" },

  errorBox: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#7f1d1d",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  errorTitle: { color: "#fecaca", fontWeight: "900", marginBottom: 4 },
  errorText: { color: "#e5e7eb", fontSize: 12, lineHeight: 16 },

  success: { marginTop: 10, color: "#9ca3af", fontSize: 12 },
});
