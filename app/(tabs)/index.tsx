import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { TileSheet } from "../../components/TileSheet";
import { RealmMap } from "../../components/realm/RealmMap";
import type { Tile } from "../../lib/types";
import {
  buildTileIndex,
  canInvest,
  investabilityReason,
  isConquered,
  isFrontier,
  isHardLocked,
} from "../../lib/world/unlockRules";
import { useGameStore } from "../../store/useGameStore";

export default function RealmScreen() {
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);

  const xp = useGameStore((s) => s.xp);
  const craft = useGameStore((s) => s.craft);
  const lore = useGameStore((s) => s.lore);
  const vigor = useGameStore((s) => s.vigor);
  const clarity = useGameStore((s) => s.clarity);
  const gold = useGameStore((s) => s.gold);

  const tiles = useGameStore((s) => s.tiles);

  const targetTileId = useGameStore((s) => s.targetTileId);
  const setTargetTile = useGameStore((s) => s.setTargetTile);
  const spendResourceOnTile = useGameStore((s) => s.spendResourceOnTile);

  useEffect(() => {
    init();
  }, [init]);


  // bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const selectedTile = useMemo(() => {
    if (!selectedTileId) return null;
    return tiles.find((t) => t.id === selectedTileId) ?? null;
  }, [tiles, selectedTileId]);

  const tileIndex = useMemo(() => buildTileIndex(tiles as Tile[]), [tiles]);

  const selectedMeta = useMemo(() => {
    if (!selectedTile)
      return {
        canInvest: false,
        reason: "",
        statusLabel: "",
      };

    const hardLocked = isHardLocked(selectedTile);
    const conquered = isConquered(selectedTile);
    const frontier = isFrontier(selectedTile, tileIndex);
    const canSpend = canInvest(selectedTile, tileIndex);
    const statusLabel = hardLocked
      ? "Sealed"
      : conquered
        ? "Conquered"
        : frontier
          ? "Frontier"
          : "Unreachable";
    const reason = canSpend ? "" : investabilityReason(selectedTile, tileIndex);

    return { canInvest: canSpend, reason, statusLabel };
  }, [selectedTile, tileIndex]);

  const onTilePress = useCallback((tileId: string) => {
    // Tap only selects a tile and opens the sheet.
    // Unlocking happens only when you spend resources.
    setSelectedTileId(tileId);
    setSheetOpen(true);
  }, []);

  if (!isReady) {
    return (
      <View
        style={[
          styles.screen,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Inner Realm"
        subtitle="Realm map"
        right={
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>XP</Text>
            <Text style={styles.pillValue}>{xp}</Text>
          </View>
        }
      />

      <View style={styles.body}>
        <View style={styles.mapArea}>
          <RealmMap
            tiles={tiles as Tile[]}
            targetTileId={targetTileId}
            onTilePress={onTilePress}
            fill
          />
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/log-session")}
        >
          <Text style={styles.primaryBtnText}>Log a session</Text>
        </Pressable>

        <TileSheet
          open={sheetOpen}
          tile={selectedTile}
          craft={craft}
          lore={lore}
          vigor={vigor}
          clarity={clarity}
          gold={gold}
          canInvest={selectedMeta.canInvest}
          reason={selectedMeta.reason}
          statusLabel={selectedMeta.statusLabel}
          isTarget={!!selectedTile && selectedTile.id === targetTileId}
          onClose={() => setSheetOpen(false)}
          onSpend={async (resource, minutes) => {
            if (!selectedTile) return;
            const res = await spendResourceOnTile(
              selectedTile.id,
              resource,
              minutes,
            );
            if (!res.ok) {
              Alert.alert("Can't invest", res.reason ?? "Unknown reason");
            }
          }}
          onToggleTarget={async () => {
            if (!selectedTile) return;
            if (selectedTile.id === targetTileId) await setTargetTile(null);
            else await setTargetTile(selectedTile.id);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  body: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },

  mapArea: { flex: 1, minHeight: 0 },


  pill: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: "flex-end",
  },
  pillLabel: { color: "#9ca3af", fontSize: 11 },
  pillValue: { color: "white", fontSize: 16, fontWeight: "900", marginTop: 2 },
});
