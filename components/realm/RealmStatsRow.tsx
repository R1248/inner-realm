import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function RealmStatsRow(props: {
  xp: number;
  boostMinutes: number;
  boostCost: number;
}) {
  const { xp, boostMinutes, boostCost } = props;

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>XP</Text>
        <Text style={styles.cardValue}>{xp}</Text>
        <Text style={styles.cardHint}>Grows with time spent</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Boost</Text>
        <Text style={styles.cardValue}>+{boostMinutes}m</Text>
        <Text style={styles.cardHint}>{boostCost} Light per tile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },

  card: {
    flex: 1,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardLabel: { color: "#9ca3af", fontSize: 12 },
  cardValue: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 6 },
  cardHint: { color: "#6b7280", fontSize: 12, marginTop: 4 },
});
