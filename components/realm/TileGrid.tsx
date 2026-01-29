import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Tile } from "../../lib/types";
import { MAX_LEVEL, levelBg, regionColors, tileProgressRatio } from "./tileUi";

function brightenHex(hex: string, amount = 0.35): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);
  return `#${((nr << 16) | (ng << 8) | nb).toString(16).padStart(6, "0")}`;
}

/**
 * Heavy grid isolated from pan/zoom updates.
 * IMPORTANT: This component must NOT receive tx/ty/scale in props.
 */
export const TileGrid = React.memo(function TileGrid(props: {
  rows: number;
  cols: number;
  tileMap: Map<string, Tile>;
  /** Tiles you can currently invest into (conquered + frontier). */
  investableTileIds?: ReadonlySet<string>;
  /** Frontier tiles: investable AND still level 0. */
  frontierTileIds?: ReadonlySet<string>;
  hardLockedTileIds?: ReadonlySet<string>;
  tileSize: number;
  gap: number;
  targetTileId: string | null;
  onTilePress: (tileId: string) => void;
}) {
  const {
    rows,
    cols,
    tileMap,
    investableTileIds,
    frontierTileIds,
    hardLockedTileIds,
    tileSize,
    gap,
    targetTileId,
    onTilePress,
  } = props;

  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <View
          key={r}
          style={{
            flexDirection: "row",
            marginBottom: r === rows - 1 ? 0 : gap,
          }}
        >
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
            const isHardLocked = hardLockedTileIds?.has(t.id) ?? false;
            const isInvestable = investableTileIds?.has(t.id) ?? false;
            const isFrontier = frontierTileIds?.has(t.id) ?? false;
            const isUnreachable = !isHardLocked && !isInvestable;
            const frontierBorder = brightenHex(fill || border, 0.4);

            const level = Math.max(0, Math.min(MAX_LEVEL, t.level));
            const ratio = tileProgressRatio(t);

            return (
              <Pressable
                key={c}
                onPress={() => onTilePress(t.id)}
                style={[
                  styles.tile,
                  {
                    width: tileSize,
                    height: tileSize,
                    marginRight: c === cols - 1 ? 0 : gap,
                    borderColor: isHardLocked
                      ? "#111827"
                      : isFrontier
                        ? frontierBorder
                        : border,
                    backgroundColor: isHardLocked
                      ? "#020305"
                      : levelBg(t.region, t.level),
                    borderWidth: isTarget || isFrontier ? 2 : 1,
                    opacity: isHardLocked ? 0.25 : isUnreachable ? 0.35 : 1,
                  },
                ]}
              >
                {isTarget ? <View style={styles.targetDot} /> : null}
                {isHardLocked ? <Text style={styles.lockText}>LOCK</Text> : null}
                {isFrontier ? <Text style={styles.frontierText}>FRONT</Text> : null}

                {level > 0 ? (
                  <Text style={styles.tileText}>{level}</Text>
                ) : (
                  <View style={styles.tileDot} />
                )}

                <View style={styles.tileBarTrack}>
                  <View
                    style={[
                      styles.tileBarFill,
                      {
                        width: `${Math.round(ratio * 100)}%`,
                        backgroundColor: fill,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  tile: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileText: { color: "white", fontSize: 12, fontWeight: "900" },
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

  lockText: {
    position: "absolute",
    top: 4,
    left: 6,
    fontSize: 10,
    opacity: 0.95,
  },

  frontierText: {
    position: "absolute",
    top: 4,
    left: 6,
    fontSize: 11,
    opacity: 0.95,
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
});

