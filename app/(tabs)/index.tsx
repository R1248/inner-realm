import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { TileSheet } from "../../components/TileSheet";
import { RealmMap } from "../../components/realm/RealmMap";
import { RealmStatsRow } from "../../components/realm/RealmStatsRow";
import type { Tile } from "../../lib/types";
import { useGameStore } from "../../store/useGameStore";

export default function RealmScreen() {
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);

  const xp = useGameStore((s) => s.xp);
  const light = useGameStore((s) => s.light);
  const tiles = useGameStore((s) => s.tiles);

  const targetTileId = useGameStore((s) => s.targetTileId);
  const setTargetTile = useGameStore((s) => s.setTargetTile);

  const spendLightBoostTile = useGameStore((s) => s.spendLightBoostTile);
  const boostCost = useGameStore((s) => s.boostCost);
  const boostMinutes = useGameStore((s) => s.boostMinutes);

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

  const onTilePress = useCallback((tileId: string) => {
    setSelectedTileId(tileId);
    setSheetOpen(true);
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Inner Realm"
        subtitle="Pan • pinch to zoom"
        right={
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Light</Text>
            <Text style={styles.pillValue}>{light}</Text>
          </View>
        }
      />

      <View style={styles.body}>
        <RealmStatsRow xp={xp} boostMinutes={boostMinutes} boostCost={boostCost} />

        <Pressable style={styles.primaryBtn} onPress={() => router.push("/log-session")}>
          <Text style={styles.primaryBtnText}>Log a session</Text>
        </Pressable>

        <Text style={styles.help}>Tap tile → actions. Drag anywhere on the map to pan. Pinch to zoom.</Text>

        <RealmMap tiles={tiles as Tile[]} targetTileId={targetTileId} onTilePress={onTilePress} />

        <TileSheet
          open={sheetOpen}
          tile={selectedTile}
          light={light}
          boostCost={boostCost}
          boostMinutes={boostMinutes}
          isTarget={!!selectedTile && selectedTile.id === targetTileId}
          onClose={() => setSheetOpen(false)}
          onBoost={async () => {
            if (!selectedTile) return;
            await spendLightBoostTile(selectedTile.id);
          }}
          onLogHere={() => {
            if (!selectedTile) return;
            setSheetOpen(false);
            router.push({ pathname: "/log-session", params: { tileId: selectedTile.id } });
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

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },

  help: { marginTop: 10, color: "#9ca3af", fontSize: 12, lineHeight: 16 },

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
