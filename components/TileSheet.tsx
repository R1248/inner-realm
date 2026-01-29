import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Tile } from "../lib/types";
import { regionLabel } from "../lib/world/regions";
import { MAX_LEVEL, segmentNeed, totalRequiredForLevel } from "./realm/tileUi";

type SpendResource = "craft" | "lore" | "vigor" | "clarity";

const SPEND_AMOUNTS = [5, 25, 60];

type Props = {
  open: boolean;
  tile: Tile | null;
  craft: number;
  lore: number;
  vigor: number;
  clarity: number;
  gold?: number;

  canInvest: boolean;
  reason?: string;
  statusLabel?: string;

  isTarget: boolean;

  onClose: () => void;
  onSpend: (resource: SpendResource, minutes: number) => Promise<void> | void;
  onToggleTarget: () => Promise<void> | void;
};

function featureLabel(feature: Tile["feature"]): string {
  if (!feature) return "None";
  switch (feature) {
    case "gate":
      return "Gate";
    case "void":
      return "Void";
    case "jailor_citadel":
      return "Jailor Citadel";
    case "black_star":
      return "Black Star";
    default:
      return String(feature);
  }
}

export function TileSheet({
  open,
  tile,
  craft,
  lore,
  vigor,
  clarity,
  gold,
  canInvest,
  reason,
  statusLabel,
  isTarget,
  onClose,
  onSpend,
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

  const resourceRows: { key: SpendResource; label: string; value: number }[] = [
    { key: "craft", label: "Craft", value: craft },
    { key: "lore", label: "Lore", value: lore },
    { key: "vigor", label: "Vigor", value: vigor },
    { key: "clarity", label: "Clarity", value: clarity },
  ];

  const canSpend = !!tile && canInvest && !!info && !info.isMax;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {tile ? `${regionLabel(tile.region)} (${tile.row}, ${tile.col})` : "Tile"}
          </Text>

          {statusLabel ? (
            <View style={[styles.badge, canInvest ? styles.badgeOn : styles.badgeOff]}>
              <Text style={[styles.badgeText, canInvest ? styles.badgeTextOn : styles.badgeTextOff]}>
                {statusLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {tile && info ? (
          <>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Level</Text>
                <Text style={styles.metaValue}>{tile.level}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Progress</Text>
                <Text style={styles.metaValue}>{tile.progress}m</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Feature</Text>
                <Text style={styles.metaValue}>{featureLabel(tile.feature)}</Text>
              </View>
            </View>

            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(info.ratio * 100)}%` }]} />
            </View>

            <View style={styles.resourceRow}>
              {resourceRows.map((r) => (
                <View key={r.key} style={styles.resChip}>
                  <Text style={styles.resLabel}>{r.label}</Text>
                  <Text style={styles.resValue}>{r.value}</Text>
                </View>
              ))}
              {typeof gold === "number" ? (
                <View style={styles.resChip}>
                  <Text style={styles.resLabel}>Gold</Text>
                  <Text style={styles.resValue}>{gold}</Text>
                </View>
              ) : null}
            </View>

            {!canInvest && reason ? (
              <Text style={styles.readonlyHint}>{reason}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>Spend resources</Text>
            {resourceRows.map((r) => (
              <View key={r.key} style={styles.spendRow}>
                <Text style={styles.spendLabel}>
                  {r.label} ({r.value})
                </Text>
                <View style={styles.spendButtons}>
                  {SPEND_AMOUNTS.map((amt) => {
                    const disabled = !canSpend || r.value < amt;
                    return (
                      <Pressable
                        key={`${r.key}-${amt}`}
                        disabled={disabled}
                        onPress={() => onSpend(r.key, amt)}
                        style={[styles.spendBtn, disabled ? styles.btnDisabled : null]}
                      >
                        <Text style={[styles.spendBtnText, disabled ? styles.btnTextDisabled : null]}>
                          +{amt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={styles.actions}>
              <Pressable style={styles.btnSecondary} onPress={onToggleTarget}>
                <Text style={styles.btnSecondaryText}>{isTarget ? "Clear target" : "Set as target"}</Text>
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

  badgeText: { fontWeight: "900", fontSize: 12 },
  badgeTextOn: { color: "#000" },
  badgeTextOff: { color: "#e5e7eb" },

  metaRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  metaPill: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaLabel: { color: "#9ca3af", fontSize: 11, fontWeight: "800" },
  metaValue: { color: "white", fontSize: 12, fontWeight: "900", marginTop: 4 },

  barTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)" },

  resourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  resChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resLabel: { color: "#9ca3af", fontSize: 11, fontWeight: "800" },
  resValue: { color: "#e5e7eb", fontWeight: "900" },

  readonlyHint: { marginTop: 10, color: "#6b7280", fontSize: 12, lineHeight: 16 },

  sectionLabel: { marginTop: 12, color: "#e5e7eb", fontWeight: "900", fontSize: 12 },
  spendRow: { marginTop: 10 },
  spendLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "800", marginBottom: 6 },
  spendButtons: { flexDirection: "row", gap: 8 },
  spendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  spendBtnText: { color: "#000", fontWeight: "900" },
  btnDisabled: { backgroundColor: "#111827" },
  btnTextDisabled: { color: "#6b7280" },

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
