import React, { memo, useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../../components/AppHeader";
import { buildDayAggMap, makeLastNDaysKeys, type DayAgg } from "../../lib/progressMetrics";
import { useGameStore } from "../../store/useGameStore";

const DAYS = 14;
const XP_PER_LEVEL = 500;

const AREA_DEFS = [
  { key: "body", label: "Body", icon: "barbell-outline", activityRoute: "sport" },
  { key: "mind", label: "Mind", icon: "bulb-outline", activityRoute: "study" },
  { key: "discipline", label: "Discipline", icon: "shield-checkmark-outline", activityRoute: "work" },
  { key: "sleep", label: "Sleep", icon: "moon-outline", activityRoute: null },
] as const;

type AreaKey = typeof AREA_DEFS[number]["key"];

const AREA_EMOJI: Record<AreaKey, string> = {
  body: "💪",
  mind: "🧠",
  discipline: "🧭",
  sleep: "🌙",
};

const EQUIPMENT_SLOTS = [
  { id: "head", label: "Head", requiredLevel: 2 },
  { id: "chest", label: "Chest", requiredLevel: 3 },
  { id: "hands", label: "Hands", requiredLevel: 4 },
  { id: "legs", label: "Legs", requiredLevel: 5 },
  { id: "feet", label: "Feet", requiredLevel: 6 },
  { id: "trinket", label: "Trinket", requiredLevel: 7 },
];

const FALLBACK_MILESTONES = [
  { id: "m1", title: "Foundations laid", unlockedAt: "2026-01-20" },
  { id: "m2", title: "First focus streak", unlockedAt: "2026-01-18" },
  { id: "m3", title: "Gate whispers", unlockedAt: "2026-01-15" },
];

function formatShortDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function levelForXp(xp: number) {
  const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const inLevel = xp % XP_PER_LEVEL;
  return { level, inLevel, next: XP_PER_LEVEL, ratio: clamp01(inLevel / XP_PER_LEVEL) };
}

function streakForTotal(dayKeys: string[], map: Map<string, DayAgg>) {
  let streak = 0;
  for (const key of dayKeys) {
    const agg = map.get(key);
    const value = agg ? agg.total : 0;
    if (value > 0) streak += 1;
    else break;
  }
  return streak;
}

function sumDays(dayKeys: string[], map: Map<string, DayAgg>, get: (agg: DayAgg) => number) {
  let total = 0;
  for (const key of dayKeys) {
    const agg = map.get(key);
    if (!agg) continue;
    total += get(agg);
  }
  return total;
}

function streakForArea(dayKeys: string[], map: Map<string, DayAgg>, get: (agg: DayAgg) => number) {
  let streak = 0;
  for (const key of dayKeys) {
    const agg = map.get(key);
    const value = agg ? get(agg) : 0;
    if (value > 0) streak += 1;
    else break;
  }
  return streak;
}

function trendForArea(
  dayKeys: string[],
  map: Map<string, DayAgg>,
  get: (agg: DayAgg) => number,
): "up" | "down" | "flat" {
  const recent = dayKeys.slice(0, 7);
  const prev = dayKeys.slice(7, 14);
  const recentSum = sumDays(recent, map, get);
  const prevSum = sumDays(prev, map, get);
  if (prevSum <= 0) return recentSum > 0 ? "up" : "flat";
  const delta = (recentSum - prevSum) / prevSum;
  if (delta > 0.1) return "up";
  if (delta < -0.1) return "down";
  return "flat";
}

function trendIcon(trend: "up" | "down" | "flat") {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

const XpBar = memo(function XpBar({ ratio }: { ratio: number }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  );
});

const SectionHeader = memo(function SectionHeader({ title, actionLabel, onAction }: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} accessibilityLabel={actionLabel}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const CharacterHeroCard = memo(function CharacterHeroCard({
  name,
  title,
  level,
  xp,
  xpNext,
  streak,
}: {
  name: string;
  title?: string | null;
  level: number;
  xp: number;
  xpNext: number;
  streak?: number | null;
}) {
  const ratio = xpNext > 0 ? xp / xpNext : 0;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "IR"}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{name}</Text>
          {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
        </View>
        <View style={styles.heroLevelChip}>
          <Text style={styles.heroLevelText}>Lv {level}</Text>
        </View>
      </View>

      <View style={styles.heroXpRow}>
        <Text style={styles.heroXpText}>{xp}/{xpNext} XP</Text>
      </View>
      <XpBar ratio={ratio} />

      {typeof streak === "number" ? (
        <View style={styles.heroBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔥 {streak} day streak</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const AttributeCard = memo(function AttributeCard({
  emoji,
  label,
  level,
  ratio,
  streak,
  trend,
  onPress,
}: {
  emoji: string;
  label: string;
  level: number;
  ratio: number;
  streak: number;
  trend?: "up" | "down" | "flat";
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.attrCard}
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${label} details`}
    >
      <View style={styles.attrHeader}>
        <Text style={styles.attrEmoji}>{emoji}</Text>
        <Text style={styles.attrLabel}>{label}</Text>
      </View>
      <Text style={styles.attrLevel}>Lv {level}</Text>
      <XpBar ratio={ratio} />
      <View style={styles.attrFooter}>
        <Text style={styles.attrStreak}>🔥 {streak}d</Text>
        {trend ? <Text style={styles.attrTrend}>{trendIcon(trend)}</Text> : null}
      </View>
    </Pressable>
  );
});

const MilestoneRow = memo(function MilestoneRow({ title, date }: { title: string; date: string }) {
  return (
    <View style={styles.milestoneRow}>
      <Text style={styles.milestoneTitle}>{title}</Text>
      <Text style={styles.milestoneDate}>{date}</Text>
    </View>
  );
});

const EquipmentSlot = memo(function EquipmentSlot({
  label,
  unlocked,
  requiredLevel,
}: {
  label: string;
  unlocked: boolean;
  requiredLevel: number;
}) {
  return (
    <View style={[styles.equipSlot, unlocked ? styles.equipSlotOn : styles.equipSlotOff]}>
      {unlocked ? (
        <Ionicons name="flash-outline" size={20} color="#e5e7eb" />
      ) : (
        <Text style={styles.equipLock}>🔒</Text>
      )}
      <Text style={styles.equipLabel}>{label}</Text>
      {!unlocked ? (
        <Text style={styles.equipHint}>Unlock at Lv {requiredLevel}</Text>
      ) : null}
    </View>
  );
});

export default function CharacterScreen() {
  const router = useRouter();
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);
  const sessions = useGameStore((s) => s.sessions);
  const xp = useGameStore((s) => s.xp);

  useEffect(() => {
    init();
  }, [init]);

  const dayKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);
  const aggMap = useMemo(() => buildDayAggMap(sessions, dayKeys), [sessions, dayKeys]);
  const globalStreak = useMemo(() => streakForTotal(dayKeys, aggMap), [aggMap, dayKeys]);

  const overall = useMemo(() => levelForXp(xp), [xp]);

  const areas = useMemo(() => {
    return AREA_DEFS.map((area) => {
      const getValue = (agg: DayAgg) => {
        if (area.key === "body") return agg.sport;
        if (area.key === "discipline") return agg.work;
        if (area.key === "sleep") return agg.meditation;
        return agg.study + agg.meditation; // mind
      };

      const total = sumDays(dayKeys, aggMap, getValue);
      const levelData = levelForXp(total * 20);
      const streak = streakForArea(dayKeys, aggMap, getValue);
      const trend = trendForArea(dayKeys, aggMap, getValue);
      return {
        key: area.key,
        label: area.label,
        emoji: AREA_EMOJI[area.key],
        level: levelData.level,
        ratio: levelData.ratio,
        streak,
        trend,
        activityRoute: area.activityRoute,
      };
    });
  }, [aggMap, dayKeys]);

  const milestones = useMemo(() => FALLBACK_MILESTONES.slice(0, 3), []);

  const equipment = useMemo(() => {
    return EQUIPMENT_SLOTS.map((slot) => ({
      ...slot,
      unlocked: overall.level >= slot.requiredLevel,
    }));
  }, [overall.level]);

  if (!isReady) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#9ca3af", fontWeight: "800" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Character" subtitle="Your inner realm" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <CharacterHeroCard
          name="Wanderer"
          title="Aspirant"
          level={overall.level}
          xp={overall.inLevel}
          xpNext={overall.next}
          streak={globalStreak}
        />

        <SectionHeader title="Oblasti rozvoje" />
        <View style={styles.attrGrid}>
          {areas.map((area) => (
            <AttributeCard
              key={area.key}
              emoji={area.emoji}
              label={area.label}
              level={area.level}
              ratio={area.ratio}
              streak={area.streak}
              trend={area.trend}
              onPress={
                area.activityRoute
                  ? () =>
                      router.push({
                        pathname: "/area/[activity]",
                        params: { activity: area.activityRoute },
                      })
                  : undefined
              }
            />
          ))}
        </View>

        <SectionHeader
          title="Recent unlocks"
          actionLabel="View all"
          onAction={() => {
            // no-op in alpha
          }}
        />
        <View style={styles.cardBlock}>
          {milestones.map((m) => (
            <MilestoneRow
              key={m.id}
              title={m.title}
              date={formatShortDate(m.unlockedAt)}
            />
          ))}
        </View>

        <SectionHeader title="Equipment" />
        <View style={styles.equipmentGrid}>
          {equipment.map((slot) => (
            <EquipmentSlot
              key={slot.id}
              label={slot.label}
              requiredLevel={slot.requiredLevel}
              unlocked={slot.unlocked}
            />
          ))}
        </View>
        <Pressable style={[styles.secondaryBtn, styles.secondaryBtnDisabled]} disabled>
          <Text style={styles.secondaryBtnText}>Customize (alpha)</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  heroCard: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "900", fontSize: 16 },
  heroInfo: { flex: 1 },
  heroName: { color: "white", fontSize: 20, fontWeight: "900" },
  heroTitle: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  heroLevelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020305",
    borderWidth: 1,
    borderColor: "#111827",
  },
  heroLevelText: { color: "#e5e7eb", fontWeight: "800", fontSize: 12 },
  heroXpRow: { marginTop: 12, marginBottom: 6 },
  heroXpText: { color: "#9ca3af", fontSize: 12, fontWeight: "700" },
  heroBadges: { flexDirection: "row", gap: 8, marginTop: 12 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020305",
  },
  badgeText: { color: "#e5e7eb", fontSize: 11, fontWeight: "800" },

  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.8)" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sectionTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
  sectionAction: { color: "#9ca3af", fontSize: 12, fontWeight: "800" },

  attrGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  attrCard: {
    width: "48%",
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  attrHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  attrEmoji: { fontSize: 18 },
  attrLabel: { color: "white", fontWeight: "900", fontSize: 14 },
  attrLevel: { color: "#e5e7eb", fontWeight: "800", marginTop: 8, marginBottom: 6 },
  attrFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  attrStreak: { color: "#9ca3af", fontSize: 11, fontWeight: "800" },
  attrTrend: { color: "#e5e7eb", fontWeight: "900" },

  cardBlock: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  milestoneRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  milestoneTitle: { color: "#e5e7eb", fontWeight: "800" },
  milestoneDate: { color: "#6b7280", fontSize: 12 },

  equipmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  equipSlot: {
    width: "31%",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  equipSlotOn: { backgroundColor: "#050608", borderColor: "#111827" },
  equipSlotOff: { backgroundColor: "#020305", borderColor: "#111827", opacity: 0.7 },
  equipLock: { fontSize: 16 },
  equipLabel: { color: "#e5e7eb", fontSize: 11, fontWeight: "800" },
  equipHint: { color: "#6b7280", fontSize: 10, textAlign: "center" },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnDisabled: { opacity: 0.6 },
  secondaryBtnText: { color: "#9ca3af", fontWeight: "800" },
});
