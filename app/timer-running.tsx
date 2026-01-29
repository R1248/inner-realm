import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useTimerStore } from "../store/useTimerStore";

function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimerRunningScreen() {
  const navigation = useNavigation();
  const activeSession = useTimerStore((s) => s.activeSession);
  const refreshActiveSession = useTimerStore((s) => s.refreshActiveSession);
  const stopSession = useTimerStore((s) => s.stopSession);

  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshActiveSession();
  }, [refreshActiveSession]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = useMemo(() => {
    if (!activeSession) return 0;
    const elapsed = Math.max(0, now - activeSession.startedAt);
    return Math.floor(elapsed / 1000);
  }, [activeSession, now]);

  const remainingSec = useMemo(() => {
    if (!activeSession || !activeSession.endsAt) return 0;
    const remaining = Math.max(0, activeSession.endsAt - now);
    return Math.floor(remaining / 1000);
  }, [activeSession, now]);

  const timerLabel = useMemo(() => {
    if (!activeSession) return "00:00";
    return activeSession.mode === "countdown"
      ? formatClock(remainingSec)
      : formatClock(elapsedSec);
  }, [activeSession, elapsedSec, remainingSec]);

  const onStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await stopSession();
      router.replace("/timer-stop");
    } finally {
      setBusy(false);
    }
  }, [busy, stopSession]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      if (!activeSession || activeSession.status !== "running") return;

      const type = e.data.action?.type;
      if (type !== "GO_BACK" && type !== "POP") return;

      e.preventDefault();
      Alert.alert(
        "Timer running",
        "A session is still running. Stop it before leaving?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop",
            style: "destructive",
            onPress: () => {
              onStop();
            },
          },
        ],
      );
    });

    return sub;
  }, [activeSession, navigation, onStop]);

  if (!activeSession || activeSession.status !== "running") {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.title}>No running session</Text>
          <Pressable style={styles.btn} onPress={() => router.replace("/timer-setup")}> 
            <Text style={styles.btnText}>Start a timer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <View style={styles.header}>
        <Text style={styles.activity}>{activeSession.activity}</Text>
        <Text style={styles.mode}>
          {activeSession.mode === "countdown" ? "Countdown" : "Countup"}
        </Text>
      </View>

      <View style={styles.timerWrap}>
        <Text style={styles.timer}>{timerLabel}</Text>
        {activeSession.mode === "countdown" ? (
          <Text style={styles.sub}>Remaining</Text>
        ) : (
          <Text style={styles.sub}>Elapsed</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.btnSecondary} disabled>
          <Text style={styles.btnSecondaryText}>Pause</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onStop}>
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000", paddingHorizontal: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },

  header: { paddingTop: 80, alignItems: "center" },
  activity: { color: "white", fontSize: 22, fontWeight: "900", textTransform: "capitalize" },
  mode: { color: "#9ca3af", fontSize: 12, marginTop: 6 },

  timerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  timer: { color: "white", fontSize: 64, fontWeight: "900" },
  sub: { color: "#6b7280", fontSize: 12, marginTop: 8 },

  actions: { flexDirection: "row", gap: 12, paddingBottom: 40 },
  btn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "900", fontSize: 16 },

  btnSecondary: {
    flex: 1,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    opacity: 0.5,
  },
  btnSecondaryText: { color: "#9ca3af", fontWeight: "800", fontSize: 16 },

  title: { color: "white", fontSize: 20, fontWeight: "800" },
});
