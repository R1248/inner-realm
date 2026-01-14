import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import type { Tile } from "../../lib/types";
import { useGameStore } from "../../store/useGameStore";

function regionColors(region: Tile["region"]) {
  switch (region) {
    case "citadel":
      return { border: "#38bdf8" }; // sky
    case "river":
      return { border: "#a78bfa" }; // violet
    case "wastelands":
    default:
      return { border: "#f59e0b" }; // amber
  }
}

function levelBg(region: Tile["region"], level: number) {
  const L = Math.max(0, Math.min(3, level));
  if (L === 0) return "#050608";
  if (region === "citadel") return ["#0b1220", "#0b1f34", "#0c2f4f"][L - 1];
  if (region === "river") return ["#150b24", "#24104a", "#35106b"][L - 1];
  return ["#1a1206", "#2a1a07", "#3a2408"][L - 1];
}

export default function RealmScreen() {
  const { isReady, xp, light, tiles, init, spendLightUpgradeTile } = useGameStore();
  const { width } = useWindowDimensions();

  useEffect(() => {
    init();
  }, [init]);

  // --- map config (future-proof; can grow later) ---
  const cols = 7;
  const rows = 7;
  const gap = 6;

  // refs for panning
  const hRef = useRef<ScrollView>(null);
  const vRef = useRef<ScrollView>(null);

  // viewport size inside the grid card (so we compute tileSize correctly)
  const [viewportW, setViewportW] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [tiles]);

  const tileSize = useMemo(() => {
    // Use actual viewport width; fallback prevents NaN before first layout pass
    const base = viewportW > 0 ? viewportW : width - 40 - 12 * 2;
    return Math.max(24, Math.floor((base - gap * (cols - 1)) / cols));
  }, [viewportW, width]);

  const contentW = cols * tileSize + gap * (cols - 1);
  const contentH = rows * tileSize + gap * (rows - 1);

  const tilesCount = tiles.length;

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
            <Text style={styles.cardLabel}>Cross-fix</Text>
            <Text style={styles.cardValue}>3</Text>
            <Text style={styles.cardHint}>Light per tile tap</Text>
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.push("/log-session")}>
          <Text style={styles.primaryBtnText}>Log a session</Text>
        </Pressable>

        <Text style={styles.help}>
          Top = Citadel (work/study), Middle = River (meditation), Bottom = Wastelands (sport/habits).
          Tap a tile to spend Light and upgrade it.
        </Text>

        <View style={styles.gridWrap}>
          <Text style={styles.tilesCount}>Tiles: {tilesCount}</Text>

          <View
            style={styles.gridViewport}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setViewportW(w);
              setViewportH(h);

              // Center the map (nice now, essential later)
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

                        const { border } = regionColors(t.region);

                        return (
                          <Pressable
                            key={c}
                            onPress={() => spendLightUpgradeTile(t.id)}
                            style={[
                              styles.tile,
                              {
                                width: tileSize,
                                height: tileSize,
                                marginRight: c === cols - 1 ? 0 : gap,
                                borderColor: border,
                                backgroundColor: levelBg(t.region, t.level),
                              },
                            ]}
                          >
                            {t.level > 0 ? (
                              <Text style={styles.tileText}>{t.level}</Text>
                            ) : (
                              <View style={styles.tileDot} />
                            )}
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

  // viewport defines available width; fixes clipping and enables panning
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
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { color: "white", fontSize: 12, fontWeight: "800" },
  tileDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#374151" },

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
