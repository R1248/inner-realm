import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { useGameStore } from "../../store/useGameStore";

export default function ProgressScreen() {
  const sessions = useGameStore((s) => s.sessions);

  const totals = sessions.reduce((acc, s) => {
    acc[s.activity] = (acc[s.activity] ?? 0) + s.minutes;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.screen}>
      <AppHeader title="Progress" subtitle="Your actions leave a trace." />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Totals (recent)</Text>
          {Object.keys(totals).length === 0 ? (
            <Text style={styles.muted}>No sessions yet.</Text>
          ) : (
            Object.entries(totals).map(([k, v]) => (
              <Text key={k} style={styles.item}>
                {k}: <Text style={styles.strong}>{v} min</Text>
              </Text>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent sessions</Text>
        {sessions.slice(0, 20).map((s) => (
          <View key={s.id} style={styles.entry}>
            <Text style={styles.entryTitle}>
              {s.activity} — {s.minutes} min
            </Text>
            <Text style={styles.entryTime}>{new Date(s.createdAt).toLocaleString()}</Text>
            {!!s.note && <Text style={styles.entryNote}>{s.note}</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  card: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardTitle: { color: "white", fontWeight: "800" },
  muted: { color: "#9ca3af", marginTop: 8 },
  item: { color: "#e5e7eb", marginTop: 6 },
  strong: { color: "white", fontWeight: "800" },

  sectionTitle: { color: "white", fontWeight: "800", marginTop: 18 },

  entry: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  entryTitle: { color: "white", fontWeight: "800" },
  entryTime: { color: "#6b7280", fontSize: 11, marginTop: 4 },
  entryNote: { color: "#d1d5db", marginTop: 6 },
});
