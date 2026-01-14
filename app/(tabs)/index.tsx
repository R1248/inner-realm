import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { TileSheet } from "../../components/TileSheet";
import type { Tile } from "../../lib/types";
import { useGameStore } from "../../store/useGameStore";

const BASE_MIN = 60;
const MAX_LEVEL = 3;

function totalRequiredForLevel(level: number) {
  // 0, 60, 180, 360 ...
  return (BASE_MIN * (level * (level + 1))) / 2;
}

function regionColors(region: Tile["region"]) {
  switch (region) {
    case "citadel":
      return { border: "#38bdf8", fill: "#38bdf8" }; // sky
    case "river":
      return { border: "#a78bfa", fill: "#a78bfa" }; // violet
    case "wastelands":
    default:
      return { border: "#f59e0b", fill: "#f59e0b" }; // amber
  }
}

function levelBg(region: Tile["region"], level: number) {
  const L = Math.max(0, Math.min(MAX_LEVEL, level));
  if (L === 0) return "#050608";
  if (region === "citadel") return ["#0b1220", "#0b1f34", "#0c2f4f"][L - 1];
  if (region === "river") return ["#150b24", "#24104a", "#35106b"][L - 1];
  return ["#1a1206", "#2a1a07", "#3a2408"][L - 1];
}

export default function RealmScreen() {
  const { width } = useWindowDimensions();

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

  // MVP map size
  const cols = 7;
  const rows = 7;
  const gap = 6;

  // panning refs
  const hRef = useRef<ScrollView>(null);
  const vRef = useRef<ScrollView>(null);

  const [viewportW, setViewportW] = useState(0);

  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  const tileSize = useMemo(() => {
    const base = viewportW > 0 ? viewportW : width - 40 - 12 * 2;
    return Math.max(24, Math.floor((base - gap * (cols - 1)) / cols));
  }, [viewportW, width]);

  const contentW = cols * tileSize + gap * (cols - 1);
  const contentH = rows * tileSize + gap * (rows - 1);

  // bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const selectedTile = useMemo(() => {
    if (!selectedTileId) return null;
    return tiles.find((t) => t.id === selectedTileId) ?? null;
  }, [tiles, selectedTileId]);

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
        subtitle="Act → Restore. Light enables cross-fixes."
        right={
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Light</Text>
            <Text style={styles.pillValue}>{light}</Text>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>XP</Text>
            <Text style={styles.cardValue}>{xp}</Text>
            <Text style={styles.cardHint}>Grows with time spent</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Boost</Text>
            <Text style={styles.cardValue}>
              +{boostMinutes}m
            </Text>
            <Text style={styles.cardHint}>{boostCost} Light per tile</Text>
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.push("/log-session")}>
          <Text style={styles.primaryBtnText}>Log a session</Text>
        </Pressable>

        <Text style={styles.help}>
          Tap a tile to open actions. Progress bars show how close that tile is to its next level (60 → +120 → +180…).
        </Text>

        <View style={styles.gridWrap}>
          <Text style={styles.tilesCount}>Tiles: {tiles.length}</Text>

          <View
            style={styles.gridViewport}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setViewportW(w);

              // center map
              requestAnimationFrame(() => {
                const x = Math.max(0, (contentW - w) / 2);
                const y = Math.max(0, (contentH - h) / 2);
                hRef.current?.scrollTo({ x, animated: false });
                vRef.current?.scrollTo({ y, animated: false });
              });
            }}
          >
            {/* Horizontal pan */}
            <ScrollView
              ref={hRef}
              horizontal
              bounces={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ width: contentW }}
              nestedScrollEnabled
            >
              {/* Vertical pan */}
              <ScrollView
                ref={vRef}
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ height: contentH }}
                nestedScrollEnabled
              >
                <View style={{ width: contentW, height: contentH }}>
                  {Array.from({ length: rows }).map((_, r) => (
                    <View key={r} style={{ flexDirection: "row", marginBottom: r === rows - 1 ? 0 : gap }}>
                      {Array.from({ length: cols }).map((_, c) => {
                        const t = tileMap.get(`${r}-${c}`);
                        if (!t) {
                          return (
                            <View
                              key={c}
                              style={{
                                width: tileSize,
                                height: tileSize,
                                marginRight: c === cols - 1 ? 0 : gap,
                              }}
                            />
                          );
                        }

                        const { border, fill } = regionColors(t.region);
                        const isTarget = t.id === targetTileId;

                        const level = Math.max(0, Math.min(MAX_LEVEL, t.level));
                        const isMax = level >= MAX_LEVEL;

                        const start = totalRequiredForLevel(level);
                        const end = totalRequiredForLevel(level + 1);
                        const within = Math.max(0, t.progress - start);
                        const need = Math.max(1, end - start);
                        const ratio = isMax ? 1 : Math.max(0, Math.min(1, within / need));

                        return (
                          <Pressable
                            key={c}
                            onPress={() => {
                              setSelectedTileId(t.id);
                              setSheetOpen(true);
                            }}
                            style={[
                              styles.tile,
                              {
                                width: tileSize,
                                height: tileSize,
                                marginRight: c === cols - 1 ? 0 : gap,
                                borderColor: border,
                                backgroundColor: levelBg(t.region, t.level),
                                borderWidth: isTarget ? 2 : 1,
                              },
                            ]}
                          >
                            {/* Target indicator */}
                            {isTarget ? <View style={styles.targetDot} /> : null}

                            {/* Center label */}
                            {t.level > 0 ? (
                              <Text style={styles.tileText}>{t.level}</Text>
                            ) : (
                              <View style={styles.tileDot} />
                            )}

                            {/* Progress bar */}
                            <View style={styles.tileBarTrack}>
                              <View
                                style={[
                                  styles.tileBarFill,
                                  { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill },
                                ]}
                              />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </View>

          <Text style={styles.gridHint}>Drag the map to pan.</Text>
        </View>
      </ScrollView>

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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

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
  cardValue: { color: "white", fontSize: 24, fontWeight: "800", marginTop: 6 },
  cardHint: { color: "#6b7280", fontSize: 12, marginTop: 4 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },

  help: { marginTop: 10, color: "#9ca3af", fontSize: 12, lineHeight: 16 },

  gridWrap: {
    marginTop: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
  },
  tilesCount: { color: "#6b7280", fontSize: 11, marginBottom: 8 },

  gridViewport: {
    width: "100%",
    height: 420,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#020305",
  },
  gridHint: { color: "#6b7280", fontSize: 11, marginTop: 10 },

  tile: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileText: { color: "white", fontSize: 12, fontWeight: "800" },
  tileDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#374151" },

  targetDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
    opacity: 0.9,
  },

  tileBarTrack: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  tileBarFill: {
    height: "100%",
    borderRadius: 999,
  },

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
  pillValue: { color: "white", fontSize: 16, fontWeight: "800", marginTop: 2 },
});
