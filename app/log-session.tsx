import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppHeader } from "../components/AppHeader";
import { QuickLogCard } from "../components/QuickLogCard";

export default function LogSession() {
  return (
    <View style={styles.screen}>
      <AppHeader title="Log session" subtitle="Focus or quick log" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Start a timer session or log minutes directly. Both create the same
          session entries.
        </Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/timer-setup")}
        >
          <Text style={styles.primaryBtnText}>Start timer session</Text>
        </Pressable>
        <QuickLogCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  hint: { color: "#6b7280", fontSize: 12, lineHeight: 16, marginBottom: 12 },

  primaryBtn: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },
});
