import { Ionicons } from "@expo/vector-icons";
import React, { memo, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import {
  buildDayAggMap,
  dayKeyLocal,
  makeLastNDaysKeys,
  type DayAgg,
} from "../../lib/progressMetrics";
import { useGameStore } from "../../store/useGameStore";

type QuestKind = "core" | "bonus" | "shadow";
type QuestCategory = "body" | "mind" | "discipline" | "sleep" | "shadow";

type Quest = {
  id: string;
  title: string;
  description?: string;
  categoryKey: QuestCategory;
  kind: QuestKind;
  xp: number;
  isCompleted: boolean;
  isActive?: boolean;
  targetMinutes?: number;
  progressMinutes?: number;
};

const FALLBACK_QUESTS: Quest[] = [
  {
    id: "core-1",
    title: "Deep work sprint",
    description: "Focus block toward your main project.",
    categoryKey: "discipline",
    kind: "core",
    xp: 120,
    isCompleted: false,
    targetMinutes: 45,
    progressMinutes: 0,
  },
  {
    id: "core-2",
    title: "Mind sharpen",
    description: "Study something that moves the needle.",
    categoryKey: "mind",
    kind: "core",
    xp: 90,
    isCompleted: false,
    targetMinutes: 30,
    progressMinutes: 0,
  },
  {
    id: "core-3",
    title: "Body pulse",
    description: "Move your body with intent.",
    categoryKey: "body",
    kind: "core",
    xp: 80,
    isCompleted: false,
    targetMinutes: 25,
    progressMinutes: 0,
  },
  {
    id: "bonus-1",
    title: "Tidy workspace",
    categoryKey: "discipline",
    kind: "bonus",
    xp: 30,
    isCompleted: false,
  },
  {
    id: "bonus-2",
    title: "Evening wind-down",
    categoryKey: "sleep",
    kind: "bonus",
    xp: 40,
    isCompleted: false,
  },
  {
    id: "shadow-1",
    title: "Resist doomscroll",
    description: "Keep distractions in check.",
    categoryKey: "shadow",
    kind: "shadow",
    xp: 60,
    isCompleted: false,
  },
  {
    id: "shadow-2",
    title: "Delay the impulse",
    description: "Pause, breathe, choose.",
    categoryKey: "shadow",
    kind: "shadow",
    xp: 50,
    isCompleted: false,
  },
];

const CATEGORY_ICON: Record<QuestCategory, string> = {
  body: "fitness-outline",
  mind: "bulb-outline",
  discipline: "shield-checkmark-outline",
  sleep: "moon-outline",
  shadow: "eye-off-outline",
};

function todayLabel() {
  const now = new Date();
  return now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
});

const ProgressBar = memo(function ProgressBar({ ratio }: { ratio: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(1, ratio)),
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [ratio, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width }]} />
    </View>
  );
});

const XpFlyup = memo(function XpFlyup({
  token,
  text,
}: {
  token: number;
  text: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!token) return;
    opacity.setValue(0);
    translate.setValue(6);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: -18,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [opacity, token, translate]);

  if (!token) return null;

  return (
    <Animated.View
      style={[
        styles.flyup,
        { opacity, transform: [{ translateY: translate }] },
      ]}
    >
      <Text style={styles.flyupText}>{text}</Text>
    </Animated.View>
  );
});

const DailySummaryHeader = memo(function DailySummaryHeader({
  dateLabel,
  streak,
}: {
  dateLabel: string;
  streak?: number | null;
}) {
  return (
    <View style={styles.summaryHeader}>
      <View>
        <Text style={styles.summaryTitle}>Today&apos;s Quests</Text>
        <Text style={styles.summaryDate}>{dateLabel}</Text>
      </View>
      {typeof streak === "number" ? (
        <View style={styles.streakChip}>
          <Text style={styles.streakText}>🔥 {streak} days</Text>
        </View>
      ) : null}
    </View>
  );
});

const DailyProgressBar = memo(function DailyProgressBar({
  completed,
  total,
  xpToday,
}: {
  completed: number;
  total: number;
  xpToday: number;
}) {
  const ratio = total > 0 ? completed / total : 0;
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>Core quests</Text>
        <Text style={styles.progressValue}>
          {completed}/{total}
        </Text>
      </View>
      <ProgressBar ratio={ratio} />
      <Text style={styles.progressHint}>+{xpToday} XP today</Text>
    </View>
  );
});

const QuestCard = memo(function QuestCard({
  quest,
  onToggleComplete,
  onStart,
  flyupToken,
}: {
  quest: Quest;
  onToggleComplete: () => void;
  onStart: () => void;
  flyupToken: number;
}) {
  const progressLabel =
    quest.targetMinutes && quest.progressMinutes != null
      ? `Progress: ${quest.progressMinutes}/${quest.targetMinutes} min`
      : null;

  const ctaLabel = quest.isCompleted
    ? "Completed"
    : quest.isActive
      ? "Continue"
      : "Start";

  return (
    <View style={styles.questCard}>
      <View style={styles.questCardRow}>
        <View style={styles.questIconWrap}>
          <Ionicons
            name={CATEGORY_ICON[quest.categoryKey] as any}
            size={18}
            color="#e5e7eb"
          />
        </View>
        <View style={styles.questCardBody}>
          <Text style={styles.questTitle}>{quest.title}</Text>
          {quest.description ? (
            <Text style={styles.questDesc}>{quest.description}</Text>
          ) : null}
          {progressLabel ? (
            <Text style={styles.questProgress}>{progressLabel}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.questCardFooter}>
        <Text style={styles.questXp}>+{quest.xp} XP</Text>
        <Pressable
          onPress={quest.isCompleted ? undefined : onStart}
          disabled={quest.isCompleted}
          accessibilityLabel={`${ctaLabel} ${quest.title}`}
          style={[
            styles.questCta,
            quest.isCompleted ? styles.questCtaDone : null,
          ]}
        >
          <Text
            style={[
              styles.questCtaText,
              quest.isCompleted ? styles.questCtaTextDone : null,
            ]}
          >
            {ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.completeBtn,
            quest.isCompleted ? styles.completeBtnOn : null,
          ]}
          onPress={onToggleComplete}
          accessibilityLabel={`Mark ${quest.title} complete`}
        >
          <Text style={styles.completeBtnText}>
            {quest.isCompleted ? "✓" : ""}
          </Text>
        </Pressable>
      </View>
      <XpFlyup token={flyupToken} text={`+${quest.xp} XP`} />
    </View>
  );
});

const QuestRow = memo(function QuestRow({
  quest,
  onToggleComplete,
  flyupToken,
}: {
  quest: Quest;
  onToggleComplete: () => void;
  flyupToken: number;
}) {
  return (
    <View style={styles.questRow}>
      <Pressable
        style={[styles.checkbox, quest.isCompleted ? styles.checkboxOn : null]}
        onPress={onToggleComplete}
        accessibilityLabel={`Toggle ${quest.title}`}
      >
        <Text style={styles.checkboxText}>{quest.isCompleted ? "✓" : ""}</Text>
      </Pressable>
      <View style={styles.questRowBody}>
        <Text
          style={[
            styles.questRowTitle,
            quest.isCompleted ? styles.questRowDone : null,
          ]}
        >
          {quest.title}
        </Text>
        {quest.description ? (
          <Text style={styles.questRowDesc}>{quest.description}</Text>
        ) : null}
      </View>
      <Text style={styles.questRowXp}>+{quest.xp}</Text>
      <XpFlyup token={flyupToken} text={`+${quest.xp} XP`} />
    </View>
  );
});

const ShadowQuestRow = memo(function ShadowQuestRow({
  quest,
  onToggleComplete,
  flyupToken,
}: {
  quest: Quest;
  onToggleComplete: () => void;
  flyupToken: number;
}) {
  return (
    <View style={styles.shadowRow}>
      <Pressable
        style={[styles.checkbox, quest.isCompleted ? styles.checkboxOn : null]}
        onPress={onToggleComplete}
        accessibilityLabel={`Toggle ${quest.title}`}
      >
        <Text style={styles.checkboxText}>{quest.isCompleted ? "✓" : ""}</Text>
      </Pressable>
      <View style={styles.questRowBody}>
        <Text
          style={[
            styles.questRowTitle,
            quest.isCompleted ? styles.questRowDone : null,
          ]}
        >
          {quest.title}
        </Text>
        {quest.description ? (
          <Text style={styles.questRowDesc}>{quest.description}</Text>
        ) : null}
      </View>
      <Text style={styles.questRowXp}>+{quest.xp}</Text>
      <XpFlyup token={flyupToken} text={`+${quest.xp} XP`} />
    </View>
  );
});

export default function QuestsScreen() {
  const isReady = useGameStore((s) => s.isReady);
  const init = useGameStore((s) => s.init);
  const sessions = useGameStore((s) => s.sessions);

  React.useEffect(() => {
    init();
  }, [init]);

  const [quests, setQuests] = useState<Quest[]>(FALLBACK_QUESTS);
  const [flyups, setFlyups] = useState<Record<string, number>>({});
  const [modalQuest, setModalQuest] = useState<Quest | null>(null);

  const dayKeys = useMemo(() => makeLastNDaysKeys(14), []);
  const aggMap = useMemo(
    () => buildDayAggMap(sessions, dayKeys),
    [sessions, dayKeys],
  );
  const streak = useMemo(
    () => streakForTotal(dayKeys, aggMap),
    [aggMap, dayKeys],
  );

  const todayKey = useMemo(() => dayKeyLocal(Date.now()), []);
  const todayAgg = aggMap.get(todayKey);
  const xpFromSessionsToday = todayAgg?.total ?? 0;

  const coreQuests = useMemo(
    () => quests.filter((q) => q.kind === "core"),
    [quests],
  );
  const bonusQuests = useMemo(
    () => quests.filter((q) => q.kind === "bonus"),
    [quests],
  );
  const shadowQuests = useMemo(
    () => quests.filter((q) => q.kind === "shadow"),
    [quests],
  );

  const completedCoreCount = useMemo(
    () => coreQuests.filter((q) => q.isCompleted).length,
    [coreQuests],
  );

  const xpFromQuests = useMemo(
    () => quests.filter((q) => q.isCompleted).reduce((sum, q) => sum + q.xp, 0),
    [quests],
  );

  const xpToday = xpFromSessionsToday + xpFromQuests;

  const toggleComplete = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuests((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, isCompleted: !q.isCompleted } : q,
      ),
    );
    setFlyups((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const handleStart = (quest: Quest) => {
    if (quest.isCompleted) return;
    setModalQuest(quest);
  };

  const markModalDone = () => {
    if (!modalQuest) return;
    toggleComplete(modalQuest.id);
    setModalQuest(null);
  };

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
      <AppHeader title="Quests" subtitle="Alpha daily loop" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <DailySummaryHeader dateLabel={todayLabel()} streak={streak} />
        <DailyProgressBar
          completed={completedCoreCount}
          total={coreQuests.length}
          xpToday={xpToday}
        />

        <SectionHeader title="CORE" subtitle="Main objectives" />
        {coreQuests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No core quests yet.</Text>
          </View>
        ) : (
          coreQuests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onToggleComplete={() => toggleComplete(quest.id)}
              onStart={() => handleStart(quest)}
              flyupToken={flyups[quest.id] ?? 0}
            />
          ))
        )}

        <SectionHeader title="BONUS" subtitle="Optional" />
        <View style={styles.listCard}>
          {bonusQuests.length === 0 ? (
            <Text style={styles.emptyText}>No bonus quests yet.</Text>
          ) : (
            bonusQuests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                onToggleComplete={() => toggleComplete(quest.id)}
                flyupToken={flyups[quest.id] ?? 0}
              />
            ))
          )}
        </View>

        <SectionHeader title="SHADOW / Zz" subtitle="Resist corruption" />
        <View style={styles.shadowCard}>
          {shadowQuests.length === 0 ? (
            <Text style={styles.emptyText}>No shadow quests yet.</Text>
          ) : (
            shadowQuests.map((quest) => (
              <ShadowQuestRow
                key={quest.id}
                quest={quest}
                onToggleComplete={() => toggleComplete(quest.id)}
                flyupToken={flyups[quest.id] ?? 0}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={!!modalQuest} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tracking not implemented</Text>
            <Text style={styles.modalText}>
              Start/continue tracking from this quest later.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalBtn}
                onPress={() => setModalQuest(null)}
              >
                <Text style={styles.modalBtnText}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={markModalDone}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                  Mark done
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { color: "white", fontSize: 20, fontWeight: "900" },
  summaryDate: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  streakChip: {
    backgroundColor: "#020305",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  streakText: { color: "#e5e7eb", fontSize: 11, fontWeight: "800" },

  progressCard: {
    marginTop: 12,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: { color: "#e5e7eb", fontWeight: "800" },
  progressValue: { color: "#e5e7eb", fontWeight: "900" },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  progressHint: {
    marginTop: 10,
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "700",
  },

  sectionHeader: { marginTop: 18 },
  sectionTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
  sectionSubtitle: { color: "#6b7280", fontSize: 11, marginTop: 4 },

  questCard: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  questCardRow: { flexDirection: "row", gap: 12 },
  questIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#020305",
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  questCardBody: { flex: 1 },
  questTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  questDesc: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  questProgress: { color: "#6b7280", fontSize: 11, marginTop: 6 },
  questCardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  questXp: { color: "#e5e7eb", fontWeight: "800", fontSize: 12 },
  questCta: {
    marginLeft: "auto",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  questCtaDone: { backgroundColor: "#111827" },
  questCtaText: { color: "#000", fontWeight: "900", fontSize: 12 },
  questCtaTextDone: { color: "#6b7280" },
  completeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  completeBtnOn: { backgroundColor: "#fff" },
  completeBtnText: { color: "#000", fontWeight: "900" },

  listCard: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  questRowBody: { flex: 1 },
  questRowTitle: { color: "#e5e7eb", fontWeight: "800" },
  questRowDesc: { color: "#6b7280", fontSize: 11, marginTop: 4 },
  questRowXp: { color: "#e5e7eb", fontWeight: "800" },
  questRowDone: { color: "#6b7280", textDecorationLine: "line-through" },

  shadowCard: {
    marginTop: 10,
    backgroundColor: "#020305",
    borderColor: "#0b1220",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  shadowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#fff" },
  checkboxText: { color: "#000", fontWeight: "900" },

  emptyCard: {
    marginTop: 10,
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  emptyText: { color: "#6b7280", fontSize: 12 },

  flyup: {
    position: "absolute",
    right: 16,
    top: 8,
  },
  flyupText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#050608",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  modalText: { color: "#9ca3af", fontSize: 12, marginTop: 6 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#020305",
    borderWidth: 1,
    borderColor: "#111827",
  },
  modalBtnPrimary: { backgroundColor: "#fff" },
  modalBtnText: { color: "#e5e7eb", fontWeight: "800", fontSize: 12 },
  modalBtnTextPrimary: { color: "#000" },
});
