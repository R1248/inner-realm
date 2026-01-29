import React from "react";
import { StyleSheet, View } from "react-native";

export function ProgressChart({
  values,
  height = 110,
  barColor = "rgba(255,255,255,0.6)",
}: {
  values: number[];
  height?: number;
  barColor?: string;
}) {
  const max = Math.max(1, ...values);

  return (
    <View style={[styles.chart, { height }]}> 
      {values.map((value, idx) => {
        const ratio = Math.max(0, Math.min(1, value / max));
        return (
          <View key={idx} style={styles.barWrap}>
            <View style={[styles.bar, { height: `${Math.round(ratio * 100)}%`, backgroundColor: barColor }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingHorizontal: 2,
  },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: 10, borderRadius: 6 },
});
