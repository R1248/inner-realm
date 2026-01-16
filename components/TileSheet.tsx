import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Tile } from "../lib/types";
import { regionLabel } from "../lib/world/regions";
import { MAX_LEVEL, segmentNeed, totalRequiredForLevel } from "./realm/tileUi";

type Props = {
  open: boolean;
  tile: Tile | null;
  light: number;

  boostCost: number;
  boostMinutes: number;

  isTarget: boolean;

  onClose: () => void;
  onBoost: () => Promise<void> | void;
  onLogHere: () => void;
  onToggleTarget: () => Promise<void> | void;
};

export function TileSheet({
  open,
  tile,
  light,
  boostCost,
  boostMinutes,
  isTarget,
  onClose,
  onBoost,
  onLogHere,
  onToggleTarget,
}: Props) {
  const info = useMemo(() => {
    if (!tile) return null;

    const level = Math.max(0, Math.min(MAX_LEVEL, tile.level));
    const isMax = level >= MAX_LEVEL;

    const start = totalRequiredForLevel(level, tile.region);
    const need = isMax ? 0 : segmentNeed(level, tile.region);
    const within = isMax ? 0 : Math.max(0, tile.progress - start);
    const ratio = isMax ? 1 : Math.max(0, Math.min(1, within / Math.max(1, need)));

    const nextTotal = isMax ? start : start + need;

    return { level, isMax, start, need, within, ratio, nextTotal };
  }, [tile]);

  const isLocked = !!tile && tile.locked === 1;
  const canBoost = !!tile && !isLocked && tile.level < MAX_LEVEL && light >= boostCost;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {tile ? `${regionLabel(tile.region)} (${tile.row}, ${tile.col})` : "Tile"}
          </Text>

          <View
            style={[
              styles.badge,
              isLocked ? styles.badgeLocked : isTarget ? styles.badgeOn : styles.badgeOff,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isLocked ? styles.badgeTextLocked : isTarget ? styles.badgeTextOn : styles.badgeTextOff,
              ]}
            >
              {isLocked ? "🔒 Locked" : isTarget ? "🎯 Target" : "Tile"}
            </Text>
          </View>
        </View>

        {tile && info ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Level</Text>
                <Text style={styles.statValue}>{tile.level}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Invested</Text>
                <Text style={styles.statValue}>{tile.progress}m</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Next</Text>
                <Text style={styles.statValue}>{info.isMax ? "MAX" : `${info.within}/${info.need}m`}</Text>
              </View>
            </View>

            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(info.ratio * 100)}%` }]} />
            </View>

            {isLocked ? (
              <Text style={styles.hint}>
                This tile is locked. Unlocking rules aren&apos;t implemented yet (you can wire them into the store when ready).
              </Text>
            ) : (
              <Text style={styles.hint}>Thresholds are cumulative and depend on region difficulty.</Text>
            )}

            <View style={styles.actions}>
              <Pressable
                style={[styles.btnPrimary, isLocked ? { opacity: 0.45 } : null]}
                disabled={isLocked}
                onPress={onLogHere}
              >
                <Text style={styles.btnPrimaryText}>Log into this tile</Text>
              </Pressable>

              <Pressable
                style={[styles.btnSecondary, isLocked ? { opacity: 0.45 } : null]}
                disabled={isLocked}
                onPress={onToggleTarget}
              >
                <Text style={styles.btnSecondaryText}>{isTarget ? "Clear target" : "Set as target"}</Text>
              </Pressable>

              <Pressable
                style={[styles.btnSecondary, canBoost ? null : { opacity: 0.45 }]}
                disabled={!canBoost}
                onPress={onBoost}
              >
                <Text style={styles.btnSecondaryText}>Boost +{boostMinutes}m ({boostCost} Light)</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={{ color: "#9ca3af" }}>No tile selected.</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
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

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: "white", fontWeight: "900", fontSize: 14 },

  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  badgeOn: { backgroundColor: "#fff", borderColor: "#fff" },
  badgeOff: { backgroundColor: "#020305", borderColor: "#111827" },
  badgeLocked: { backgroundColor: "#020305", borderColor: "#374151" },

  badgeText: { fontWeight: "900", fontSize: 12 },
  badgeTextOn: { color: "#000" },
  badgeTextOff: { color: "#e5e7eb" },
  badgeTextLocked: { color: "#e5e7eb" },

  statRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  statLabel: { color: "#9ca3af", fontSize: 11, fontWeight: "800" },
  statValue: { color: "white", fontSize: 14, fontWeight: "900", marginTop: 6 },

  barTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)" },

  hint: { marginTop: 10, color: "#6b7280", fontSize: 12, lineHeight: 16 },

  actions: { marginTop: 12, gap: 10 },

  btnPrimary: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#000", fontWeight: "900", fontSize: 14 },

  btnSecondary: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#e5e7eb", fontWeight: "900", fontSize: 14 },
});
