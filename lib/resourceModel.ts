import type { ActivityType, CoreActivityType } from "./types";

export type ResourceKey = "craft" | "lore" | "vigor" | "clarity" | "gold";
export type ResourceDelta = Partial<Record<ResourceKey, number>>;

export function normalizeActivity(a: ActivityType): ActivityType {
  // Backwards-compat: treat old "meditation" as "mindfulness".
  return a === "meditation" ? "mindfulness" : a;
}

export function isCoreActivity(a: ActivityType): a is CoreActivityType {
  const n = normalizeActivity(a);
  return n === "work" || n === "study" || n === "sport" || n === "mindfulness";
}

/**
 * Map a session to resource gains.
 * - Core activities: minutes -> a primary resource (1:1)
 * - Income: amount -> gold (if amount is provided), otherwise no gain
 * - Habit: no resource gains (habits are tracked elsewhere)
 */
export function resourceGainsForSession(args: {
  activity: ActivityType;
  minutes: number;
  amount?: number | null;
  subtype?: string | null;
}): ResourceDelta {
  const { minutes, amount } = args;
  const activity = normalizeActivity(args.activity);

  const m = Math.max(0, Math.floor(minutes || 0));

  switch (activity) {
    case "work":
      return { craft: m };
    case "study":
      return { lore: m };
    case "sport":
      return { vigor: m };
    case "mindfulness":
      return { clarity: m };
    case "income": {
      const a = Number(amount ?? 0);
      // store as integer units (UI decides CZK / EUR / etc.)
      return a > 0 ? { gold: Math.floor(a) } : {};
    }
    case "habit":
    default:
      return {};
  }
}

/**
 * Should this activity invest into tiles?
 * - core activities: YES
 * - income/habit: NO
 */
export function shouldInvestIntoTile(activity: ActivityType): boolean {
  const a = normalizeActivity(activity);
  return a === "work" || a === "study" || a === "sport" || a === "mindfulness";
}
