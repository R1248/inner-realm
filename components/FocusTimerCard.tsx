import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActivityType, SportSubtype } from "../lib/types";
import { normalizeActivity } from "../lib/resourceModel";
import { useGameStore } from "../store/useGameStore";

const activities: { key: ActivityType; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "sport", label: "Sport" },
];

const sportSubtypes: { key: SportSubtype; label: string }[] = [
  { key: "run", label: "Run" },
  { key: "strength", label: "Strength" },
  { key: "swim", label: "Swim" },
  { key: "bike", label: "Bike" },
  { key: "team", label: "Team" },
  { key: "other", label: "Other" },
];

type TimerState = "idle" | "running" | "paused";

function clampInt(n: any, min: number, max?: number): number {
  const v = Math.floor(Number(n) || 0);
  if (typeof max === "number") return Math.max(min, Math.min(max, v));
  return Math.max(min, v);
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function FocusTimerCard() {
  const addSession = useGameStore((s) => s.addSession);

  const [activity, setActivity] = useState<ActivityType>("work");
  const [sportSubtype, setSportSubtype] = useState<SportSubtype>("run");
  const [durationText, setDurationText] = useState("25");
  const [state, setState] = useState<TimerState>("idle");
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [message, setMessage] = useState<string | null>(null);

  const totalSecRef = useRef(25 * 60);
  const startRemainingRef = useRef(25 * 60);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);

  const totalMinutes = useMemo(() => clampInt(durationText, 1, 240), [durationText]);
  const isSport = normalizeActivity(activity) === "sport";

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const finishSession = useCallback(
    async (auto: boolean, elapsed: number) => {
      const minutes = Math.max(1, Math.round(elapsed / 60));
      clearTimer();
      startedAtRef.current = null;
      setState("idle");
      setRemainingSec(totalSecRef.current);
      if (elapsed < 60 && !auto) {
        setMessage("Focus session was too short to log.");
        return;
      }
      const res = await addSession(activity, minutes, isSport ? sportSubtype : undefined);
      if (!res.ok) {
        setMessage(res.reason ?? "Failed to save session.");
        return;
      }
      setMessage(`Saved ${minutes}m ${activity}.`);
    },
    [activity, addSession, clearTimer, isSport, sportSubtype],
  );

  const tick = useCallback(() => {
    if (!startedAtRef.current) return;
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    const next = Math.max(0, Math.floor(startRemainingRef.current - elapsed));
    setRemainingSec(next);
    if (next <= 0) {
      finishSession(true, totalSecRef.current);
    }
  }, [finishSession]);

  useEffect(() => {
    if (state !== "running") {
      clearTimer();
      return;
    }
    intervalRef.current = setInterval(tick, 250);
    return () => clearTimer();
  }, [clearTimer, state, tick]);

  useEffect(() => {
    if (state !== "idle") return;
    const total = totalMinutes * 60;
    totalSecRef.current = total;
    setRemainingSec(total);
  }, [state, totalMinutes]);

  const start = useCallback(() => {
    setMessage(null);
    if (state === "idle") {
      const total = totalMinutes * 60;
      totalSecRef.current = total;
      setRemainingSec(total);
      startRemainingRef.current = total;
    } else {
      startRemainingRef.current = remainingSec;
    }
    startedAtRef.current = Date.now();
    setState("running");
  }, [remainingSec, state, totalMinutes]);

  const pause = useCallback(() => {
    clearTimer();
    setState("paused");
  }, [clearTimer]);

  const stop = useCallback(() => {
    const elapsed = totalSecRef.current - remainingSec;
    finishSession(false, elapsed);
  }, [finishSession, remainingSec]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Focus timer</Text>
        <Text style={styles.subtitle}>Auto-log on completion</Text>
      </View>

      <View style={styles.timerRow}>
        <Text style={styles.timerText}>{formatTime(remainingSec)}</Text>
        <View style={styles.durationBox}>
          <Text style={styles.durationLabel}>Minutes</Text>
          <TextInput
            value={durationText}
            onChangeText={setDurationText}
            editable={state === "idle"}
            keyboardType="number-pad"
            style={[styles.durationInput, state !== "idle" ? styles.inputDisabled : null]}
          />
        </View>
      </View>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.chips}>
        {activities.map((a) => {
          const isOn = a.key === activity;
          return (
            <Pressable
              key={a.key}
              onPress={() => setActivity(a.key)}
              disabled={state !== "idle"}
              style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
                  disabled={state !== "idle"}
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

      <View style={styles.actions}>
        {state === "running" ? (
          <>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={pause}>
              <Text style={styles.btnSecondaryText}>Pause</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={stop}>
              <Text style={styles.btnText}>Stop</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.btn} onPress={start}>
              <Text style={styles.btnText}>{state === "paused" ? "Resume" : "Start"}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={stop}>
              <Text style={styles.btnSecondaryText}>Stop</Text>
            </Pressable>
          </>
        )}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
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
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "white", fontSize: 14, fontWeight: "900" },
  subtitle: { color: "#6b7280", fontSize: 11, fontWeight: "700" },

  timerRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  timerText: { color: "white", fontSize: 28, fontWeight: "900", flex: 1 },
  durationBox: { alignItems: "flex-end" },
  durationLabel: { color: "#9ca3af", fontSize: 11 },
  durationInput: {
    marginTop: 6,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "white",
    minWidth: 72,
    textAlign: "center",
  },
  inputDisabled: { opacity: 0.5 },

  label: { color: "#e5e7eb", fontWeight: "800", marginTop: 12 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipOff: { backgroundColor: "#020305", borderColor: "#111827" },
  chipText: { fontWeight: "800", fontSize: 12 },
  chipTextOn: { color: "#000" },
  chipTextOff: { color: "#e5e7eb" },

  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondary: { backgroundColor: "#020305", borderColor: "#111827", borderWidth: 1 },
  btnText: { color: "#000", fontWeight: "900" },
  btnSecondaryText: { color: "#e5e7eb", fontWeight: "900" },

  message: { marginTop: 10, color: "#9ca3af", fontSize: 12 },
});
