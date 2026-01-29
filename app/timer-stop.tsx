import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { useTimerStore } from "../store/useTimerStore";
import { estimateRewards } from "../lib/timerRewards";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function TimerStopConfirmScreen() {
  const session = useTimerStore((s) => s.activeSession);
  const commitSession = useTimerStore((s) => s.commitSession);
  const discardSession = useTimerStore((s) => s.discardSession);
  const resumeSession = useTimerStore((s) => s.resumeSession);

  const [busy, setBusy] = useState(false);

  const durationMs = useMemo(() => {
    if (!session) return 0;
    const stoppedAt = session.stoppedAt ?? Date.now();
    return Math.max(0, stoppedAt - session.startedAt);
  }, [session]);

  const minutes = useMemo(() => Math.max(1, Math.round(durationMs / 60000)), [durationMs]);

  const rewards = useMemo(() => {
    if (!session) return null;
    return estimateRewards(session.activity, minutes);
  }, [minutes, session]);

  const onConfirm = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await commitSession();
      if (!res.ok) {
        Alert.alert("Could not commit", res.reason ?? "Unknown error");
        return;
      }
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }, [busy, commitSession]);

  const onDiscard = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await discardSession();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }, [busy, discardSession]);

  const onCancel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resumeSession();
      router.replace("/timer-running");
    } finally {
      setBusy(false);
    }
  }, [busy, resumeSession]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.title}>No session to confirm</Text>
          <Pressable style={styles.btn} onPress={() => router.replace("/")}> 
            <Text style={styles.btnText}>Back to map</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>End session?</Text>
        <Text style={styles.subtitle}>{session.activity}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Duration</Text>
        <Text style={styles.value}>{formatDuration(durationMs)}</Text>
        <Text style={styles.small}>~ {minutes} min</Text>
      </View>

      {rewards ? (
        <View style={styles.card}>
          <Text style={styles.label}>Estimated rewards</Text>
          <Text style={styles.value}>+{rewards.xp} XP</Text>
          <View style={styles.rewardRow}>
            {Object.entries(rewards.resources)
              .filter(([, v]) => (v ?? 0) > 0)
              .map(([key, value]) => (
                <View key={key} style={styles.rewardChip}>
                  <Text style={styles.rewardText}>+{value} {key}</Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={onConfirm}>
          <Text style={styles.btnText}>Confirm end</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={onDiscard}>
          <Text style={styles.btnSecondaryText}>Discard</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={onCancel}>
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000", paddingHorizontal: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },

  header: { paddingTop: 80, alignItems: "center" },
  title: { color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#9ca3af", fontSize: 12, marginTop: 6, textTransform: "capitalize" },

  card: {
    marginTop: 20,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  label: { color: "#9ca3af", fontSize: 12 },
  value: { color: "white", fontSize: 20, fontWeight: "900", marginTop: 6 },
  small: { color: "#6b7280", fontSize: 12, marginTop: 4 },

  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  rewardChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020305",
    borderWidth: 1,
    borderColor: "#111827",
  },
  rewardText: { color: "#e5e7eb", fontWeight: "800", fontSize: 11 },

  actions: { marginTop: 24, gap: 10 },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "900", fontSize: 16 },
  btnSecondary: {
    backgroundColor: "#020305",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111827",
  },
  btnSecondaryText: { color: "#e5e7eb", fontWeight: "900", fontSize: 16 },
  btnGhost: {
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnGhostText: { color: "#9ca3af", fontWeight: "800", fontSize: 14 },
});
