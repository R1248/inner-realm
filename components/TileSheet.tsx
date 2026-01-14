import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Tile } from "../lib/types";

const BASE_MIN = 60;
const MAX_LEVEL = 3;

function totalRequiredForLevel(level: number) {
  return (BASE_MIN * (level * (level + 1))) / 2;
}

function regionLabel(region: Tile["region"]) {
  if (region === "citadel") return "Citadel";
  if (region === "river") return "River";
  return "Wastelands";
}

export function TileSheet(props: {
  open: boolean;
  tile: Tile | null;
  light: number;
  boostCost: number;
  boostMinutes: number;

  isTarget: boolean;

  onClose: () => void;
  onBoost: () => void;
  onLogHere: () => void;
  onToggleTarget: () => void;
}) {
  const { open, tile } = props;

  const info = useMemo(() => {
    if (!tile) return null;

    const level = Math.max(0, Math.min(MAX_LEVEL, tile.level));
    const start = totalRequiredForLevel(level);
    const end = totalRequiredForLevel(level + 1);
    const within = Math.max(0, tile.progress - start);
    const need = Math.max(1, end - start);
    const ratio = level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, within / need));

    return { level, start, end, within, need, ratio };
  }, [tile]);

  if (!tile || !info) return null;

  const isMax = tile.level >= MAX_LEVEL;
  const canBoost = !isMax && props.light >= props.boostCost;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} />

      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {regionLabel(tile.region)} • ({tile.row}, {tile.col})
            </Text>
            <Text style={styles.subtitle}>
              Level {tile.level}/{MAX_LEVEL} • Invested {tile.progress}m
            </Text>
          </View>

          {props.isTarget ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>TARGET</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round(info.ratio * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {isMax ? "Maxed" : `Next level: ${info.within}/${info.need} min`}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={props.onBoost}
            disabled={!canBoost}
            style={[styles.btn, styles.btnPrimary, !canBoost && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>
              Boost +{props.boostMinutes}m ({props.boostCost} Light)
            </Text>
          </Pressable>

          <Pressable onPress={props.onLogHere} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostText}>Log session into this tile</Text>
          </Pressable>

          <Pressable onPress={props.onToggleTarget} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostText}>{props.isTarget ? "Unset target" : "Set as target"}</Text>
          </Pressable>

          <Pressable onPress={props.onClose} style={[styles.btn, styles.btnClose]}>
            <Text style={styles.btnCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: "white", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "#9ca3af", marginTop: 6, fontSize: 12 },

  badge: {
    backgroundColor: "#0b1220",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: "#e5e7eb", fontWeight: "900", fontSize: 11 },

  progressWrap: { marginTop: 12 },
  progressBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#38bdf8" },
  progressText: { marginTop: 8, color: "#6b7280", fontSize: 12 },

  actions: { marginTop: 12, gap: 10 },

  btn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#fff" },
  btnPrimaryText: { color: "#000", fontWeight: "900" },
  btnDisabled: { opacity: 0.35 },

  btnGhost: { backgroundColor: "#020305", borderColor: "#111827", borderWidth: 1 },
  btnGhostText: { color: "#e5e7eb", fontWeight: "900" },

  btnClose: { backgroundColor: "transparent" },
  btnCloseText: { color: "#9ca3af", fontWeight: "900" },
});
