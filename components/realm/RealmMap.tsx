import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Tile } from "../../lib/types";
import { INNER_REALM_LAYOUT } from "../../lib/world/innerRealmLayout";
import { TileGrid } from "./TileGrid";

type EdgeX = "left" | "right";
type EdgeY = "top" | "bottom";

const EDGE_EPS = 16; // px threshold to treat as "near edge"

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function dist2(t0: any, t1: any) {
  const dx = (t0?.pageX ?? 0) - (t1?.pageX ?? 0);
  const dy = (t0?.pageY ?? 0) - (t1?.pageY ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function RealmMap(props: {
  tiles: Tile[];
  targetTileId: string | null;
  onTilePress: (tileId: string) => void;
  height?: number;
  gap?: number;
  edgeInset?: number; // pixels reserved on right/bottom to avoid border/subpixel clipping
}) {
  const { width } = useWindowDimensions();
  const height = props.height ?? 460;
  const gap = props.gap ?? 6;
  const edgeInset = props.edgeInset ?? 2;

  // derive rows/cols from the canonical layout (NOT from persisted tiles)
  // This keeps the map size stable even if the DB still contains legacy extra rows/cols.
  const { rows, cols } = useMemo(() => {
    const rows = Number(INNER_REALM_LAYOUT.length);
    const cols = Number(INNER_REALM_LAYOUT.reduce((m, line) => Math.max(m, line.length), 0));
    return { rows, cols };
  }, []);

  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    for (const t of props.tiles) m.set(`${t.row}-${t.col}`, t);
    return m;
  }, [props.tiles]);

  const [viewportW, setViewportW] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const viewportRef = useRef<View>(null);
  const viewportAbsRef = useRef({ x: 0, y: 0 });

  const updateViewportAbs = useCallback(() => {
    requestAnimationFrame(() => {
      viewportRef.current?.measureInWindow((x, y) => {
        viewportAbsRef.current = { x, y };
      });
    });
  }, []);

  // tilesize targets ~8 visible columns
  const tileSize = useMemo(() => {
    const base = viewportW > 0 ? viewportW : width - 40 - 12 * 2;
    const visibleCols = 8;
    return Math.max(26, Math.min(64, Math.floor((base - gap * (visibleCols - 1)) / visibleCols)));
  }, [viewportW, width, gap]);

  const contentW = cols * tileSize + gap * (cols - 1);
  const contentH = rows * tileSize + gap * (rows - 1);

  // --- native transforms (smooth) ---
  const panLayerRef = useRef<View>(null);
  const scaleLayerRef = useRef<View>(null);

  const txRef = useRef(0);
  const tyRef = useRef(0);
  const scaleRef = useRef(1);

  const [uiScale, setUiScale] = useState(1);
  const lastUiUpdateRef = useRef(0);
  const scheduleUiScaleUpdate = useCallback((s: number) => {
    const now = Date.now();
    if (now - lastUiUpdateRef.current < 80) return;
    lastUiUpdateRef.current = now;
    setUiScale(s);
  }, []);

  const minScale = 0.55;
  const maxScale = 2.2;

  const anchorRef = useRef<{ x: EdgeX; y: EdgeY }>({ x: "left", y: "top" });

  const getEdges = useCallback(
    (tx: number, ty: number, s: number) => {
      // scale around center => bbox shifts by offX/offY
      const offX = (contentW * (1 - s)) / 2;
      const offY = (contentH * (1 - s)) / 2;

      const left = tx + offX;
      const top = ty + offY;
      const right = left + contentW * s;
      const bottom = top + contentH * s;

      return { left, top, right, bottom };
    },
    [contentW, contentH]
  );

  const applyNativeTransform = useCallback((tx: number, ty: number, s: number) => {
    txRef.current = tx;
    tyRef.current = ty;
    scaleRef.current = s;

    // two layers => translate is in screen pixels (not scaled)
    panLayerRef.current?.setNativeProps({
      style: { transform: [{ translateX: tx }, { translateY: ty }] },
    });
    scaleLayerRef.current?.setNativeProps({
      style: { transform: [{ scale: s }] },
    });
  }, []);

  const updateAnchorsFromCurrent = useCallback(() => {
    if (viewportW <= 0 || viewportH <= 0) return;

    const { left, top, right, bottom } = getEdges(txRef.current, tyRef.current, scaleRef.current);

    const rightEdgeGoal = viewportW - edgeInset;
    const bottomEdgeGoal = viewportH - edgeInset;

    const gapLeft = left;
    const gapTop = top;
    const gapRight = rightEdgeGoal - right;
    const gapBottom = bottomEdgeGoal - bottom;

    // whichever side is closer becomes anchor
    anchorRef.current.x = Math.abs(gapLeft) <= Math.abs(gapRight) ? "left" : "right";
    anchorRef.current.y = Math.abs(gapTop) <= Math.abs(gapBottom) ? "top" : "bottom";
  }, [viewportW, viewportH, getEdges, edgeInset]);

  const clampTranslation = useCallback(
    (nextTx: number, nextTy: number, s: number, lockX: EdgeX | null, lockY: EdgeY | null) => {
      if (viewportW <= 0 || viewportH <= 0) return { x: nextTx, y: nextTy };

      const W = contentW;
      const H = contentH;

      const offX = (W * (1 - s)) / 2;
      const offY = (H * (1 - s)) / 2;

      const scaledW = W * s;
      const scaledH = H * s;

      const rightEdgeGoal = viewportW - edgeInset;
      const bottomEdgeGoal = viewportH - edgeInset;

      // align edges to goals
      const txLeft = -offX; // left edge = 0
      const txRight = rightEdgeGoal - offX - scaledW; // right edge = viewportW - inset

      const tyTop = -offY; // top edge = 0
      const tyBottom = bottomEdgeGoal - offY - scaledH; // bottom edge = viewportH - inset

      let x = nextTx;
      let y = nextTy;

      if (scaledW <= rightEdgeGoal) {
        const ax = lockX ?? anchorRef.current.x;
        x = ax === "left" ? txLeft : txRight;
      } else {
        x = clamp(nextTx, txRight, txLeft);
      }

      if (scaledH <= bottomEdgeGoal) {
        const ay = lockY ?? anchorRef.current.y;
        y = ay === "top" ? tyTop : tyBottom;
      } else {
        y = clamp(nextTy, tyBottom, tyTop);
      }

      return { x, y };
    },
    [viewportW, viewportH, contentW, contentH, edgeInset]
  );

  const animateTo = useCallback(
    (toTx: number, toTy: number, toS: number, ms = 120) => {
      const fromTx = txRef.current;
      const fromTy = tyRef.current;
      const fromS = scaleRef.current;
      const t0 = Date.now();

      const tick = () => {
        const t = (Date.now() - t0) / ms;
        const k = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); // easeOutCubic

        const nx = fromTx + (toTx - fromTx) * k;
        const ny = fromTy + (toTy - fromTy) * k;
        const ns = fromS + (toS - fromS) * k;

        applyNativeTransform(nx, ny, ns);

        if (k < 1) requestAnimationFrame(tick);
        else setUiScale(toS);
      };

      requestAnimationFrame(tick);
    },
    [applyNativeTransform]
  );

  const snapToBounds = useCallback(
    (animated: boolean) => {
      const s = clamp(scaleRef.current, minScale, maxScale);
      const clamped = clampTranslation(txRef.current, tyRef.current, s, null, null);

      if (animated) animateTo(clamped.x, clamped.y, s, 120);
      else {
        applyNativeTransform(clamped.x, clamped.y, s);
        setUiScale(s);
      }

      requestAnimationFrame(updateAnchorsFromCurrent);
    },
    [animateTo, clampTranslation, applyNativeTransform, updateAnchorsFromCurrent]
  );

  // init: center once; afterwards only clamp (don’t steal user position)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (viewportW <= 0 || viewportH <= 0) return;

    if (!didInitRef.current) {
      didInitRef.current = true;

      const s = 1;
      // center for scale-around-center model
      const offX = (contentW * (1 - s)) / 2;
      const offY = (contentH * (1 - s)) / 2;

      const txCenter = (viewportW - contentW * s) / 2 - offX;
      const tyCenter = (viewportH - contentH * s) / 2 - offY;

      const clamped = clampTranslation(txCenter, tyCenter, s, "left", "top");
      applyNativeTransform(clamped.x, clamped.y, s);
      setUiScale(s);
      updateAnchorsFromCurrent();
      return;
    }

    // content or viewport changed → keep within bounds
    snapToBounds(false);
  }, [viewportW, viewportH, contentW, contentH, clampTranslation, applyNativeTransform, snapToBounds, updateAnchorsFromCurrent]);

  const gestureRef = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    lastPanX: 0,
    lastPanY: 0,
    startDist: 1,
    startScale: 1,
    lockX: null as EdgeX | null,
    lockY: null as EdgeY | null,
  });

  const computeEdgeLock = useCallback(() => {
    if (viewportW <= 0 || viewportH <= 0) return { lockX: null as EdgeX | null, lockY: null as EdgeY | null };

    const { left, top, right, bottom } = getEdges(txRef.current, tyRef.current, scaleRef.current);

    const rightEdgeGoal = viewportW - edgeInset;
    const bottomEdgeGoal = viewportH - edgeInset;

    const gapLeft = left;
    const gapTop = top;
    const gapRight = rightEdgeGoal - right;
    const gapBottom = bottomEdgeGoal - bottom;

    let lockX: EdgeX | null = null;
    let lockY: EdgeY | null = null;

    if (Math.abs(gapLeft) <= EDGE_EPS || gapLeft > 1) lockX = "left";
    else if (Math.abs(gapRight) <= EDGE_EPS || gapRight > 1) lockX = "right";

    if (Math.abs(gapTop) <= EDGE_EPS || gapTop > 1) lockY = "top";
    else if (Math.abs(gapBottom) <= EDGE_EPS || gapBottom > 1) lockY = "bottom";

    return { lockX, lockY };
  }, [viewportW, viewportH, getEdges, edgeInset]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        const touches = evt.nativeEvent.touches?.length ?? 0;
        return touches >= 2;
      },
      onMoveShouldSetPanResponderCapture: (evt, gs) => {
        const touches = evt.nativeEvent.touches?.length ?? 0;
        if (touches >= 2) return true;
        return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gs) => {
        const touches = evt.nativeEvent.touches?.length ?? 0;
        if (touches >= 2) return true;
        return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
      },

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches?.length ?? 0;
        updateViewportAbs();

        if (touches >= 2) {
          const t0 = evt.nativeEvent.touches[0];
          const t1 = evt.nativeEvent.touches[1];

          gestureRef.current.mode = "pinch";
          gestureRef.current.startDist = Math.max(1, dist2(t0, t1));
          gestureRef.current.startScale = scaleRef.current;

          const { lockX, lockY } = computeEdgeLock();
          gestureRef.current.lockX = lockX;
          gestureRef.current.lockY = lockY;
        } else if (touches === 1) {
          const t = evt.nativeEvent.touches[0];
          gestureRef.current.mode = "pan";
          gestureRef.current.lastPanX = t?.pageX ?? 0;
          gestureRef.current.lastPanY = t?.pageY ?? 0;
        } else {
          gestureRef.current.mode = "none";
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches?.length ?? 0;

        if (touches >= 2) {
          const t0 = evt.nativeEvent.touches[0];
          const t1 = evt.nativeEvent.touches[1];
          const d = Math.max(1, dist2(t0, t1));

          // next scale
          const raw = gestureRef.current.startScale * (d / gestureRef.current.startDist);
          const nextScale = clamp(raw, minScale, maxScale);

          // focal relative to viewport
          const vx = viewportAbsRef.current.x;
          const vy = viewportAbsRef.current.y;
          const fx = (((t0?.pageX ?? 0) + (t1?.pageX ?? 0)) / 2) - vx;
          const fy = (((t0?.pageY ?? 0) + (t1?.pageY ?? 0)) / 2) - vy;

          const curScale = scaleRef.current;
          const k = nextScale / Math.max(0.0001, curScale);

          const cx = contentW / 2;
          const cy = contentH / 2;

          let nextTx = k * txRef.current + (1 - k) * (fx - cx);
          let nextTy = k * tyRef.current + (1 - k) * (fy - cy);

          // avoid dead-zone when clamped
          if (raw !== nextScale) {
            gestureRef.current.startScale = nextScale;
            gestureRef.current.startDist = d;
          }

          const clamped = clampTranslation(nextTx, nextTy, nextScale, gestureRef.current.lockX, gestureRef.current.lockY);
          applyNativeTransform(clamped.x, clamped.y, nextScale);
          scheduleUiScaleUpdate(nextScale);
          return;
        }

        if (touches === 1) {
          const t = evt.nativeEvent.touches[0];
          const px = t?.pageX ?? 0;
          const py = t?.pageY ?? 0;

          const dx = px - gestureRef.current.lastPanX;
          const dy = py - gestureRef.current.lastPanY;

          gestureRef.current.lastPanX = px;
          gestureRef.current.lastPanY = py;

          const s = scaleRef.current;
          const nextTx = txRef.current + dx;
          const nextTy = tyRef.current + dy;

          const clamped = clampTranslation(nextTx, nextTy, s, null, null);
          applyNativeTransform(clamped.x, clamped.y, s);
          updateAnchorsFromCurrent();
        }
      },

      onPanResponderRelease: () => {
        gestureRef.current.mode = "none";
        snapToBounds(true);
      },
      onPanResponderTerminate: () => {
        gestureRef.current.mode = "none";
        snapToBounds(true);
      },
      onPanResponderTerminationRequest: () => true,
    });
  }, [applyNativeTransform, clampTranslation, computeEdgeLock, contentW, contentH, scheduleUiScaleUpdate, snapToBounds, updateAnchorsFromCurrent, updateViewportAbs]);

  const zoomTo = useCallback(
    (nextScale: number) => {
      if (viewportW <= 0 || viewportH <= 0) return;

      const curScale = scaleRef.current;
      const s = clamp(nextScale, minScale, maxScale);

      // zoom around viewport center
      const fx = viewportW / 2;
      const fy = viewportH / 2;

      const k = s / Math.max(0.0001, curScale);
      const cx = contentW / 2;
      const cy = contentH / 2;

      const nextTx = k * txRef.current + (1 - k) * (fx - cx);
      const nextTy = k * tyRef.current + (1 - k) * (fy - cy);

      const { lockX, lockY } = computeEdgeLock();
      const clamped = clampTranslation(nextTx, nextTy, s, lockX, lockY);
      animateTo(clamped.x, clamped.y, s, 120);
    },
    [viewportW, viewportH, contentW, contentH, computeEdgeLock, clampTranslation, animateTo]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        Grid: {rows}×{cols} • Scale: {Math.round(uiScale * 100)}%
      </Text>

      <View
        ref={viewportRef}
        collapsable={false}
        style={[styles.viewport, { height }]}
        onLayout={(e) => {
          setViewportW(e.nativeEvent.layout.width);
          setViewportH(e.nativeEvent.layout.height);
          updateViewportAbs();
        }}
        {...panResponder.panHandlers}
      >
        <View ref={panLayerRef} collapsable={false} style={styles.panLayer}>
          <View
            ref={scaleLayerRef}
            collapsable={false}
            style={[styles.scaleLayer, { width: contentW, height: contentH }]}
          >
            <TileGrid
              rows={rows}
              cols={cols}
              tileMap={tileMap}
              tileSize={tileSize}
              gap={gap}
              targetTileId={props.targetTileId}
              onTilePress={props.onTilePress}
            />
          </View>
        </View>

        <View style={styles.zoomBox} pointerEvents="box-none">
          <Pressable style={styles.zoomBtn} onPress={() => zoomTo(scaleRef.current * 1.15)}>
            <Text style={styles.zoomBtnText}>＋</Text>
          </Pressable>
          <Pressable style={styles.zoomBtn} onPress={() => zoomTo(scaleRef.current / 1.15)}>
            <Text style={styles.zoomBtnText}>－</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.hint}>Tip: pinch to zoom, drag to pan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
  },
  meta: { color: "#6b7280", fontSize: 11, marginBottom: 8 },

  viewport: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#020305",
  },

  panLayer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  scaleLayer: {
    position: "absolute",
    left: 0,
    top: 0,
  },

  zoomBox: { position: "absolute", right: 10, bottom: 10, gap: 10 },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: { color: "white", fontSize: 22, fontWeight: "900" },

  hint: { color: "#6b7280", fontSize: 11, marginTop: 10 },
});
