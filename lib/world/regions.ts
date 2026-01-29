import type { ActivityType, RegionType, TileFeature } from "../types";

export type RegionGroup =
  | "wastelands"
  | "river"
  | "citadel"
  | "depths"
  | "void";

export type RegionCode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export const REGION_BY_CODE = {
  "1": "mountains_doubt",
  "2": "river_despair",
  "3": "wastelands_ash_dust",
  "4": "forest_decay",
  "5": "great_depths",
  "6": "planes_fire_ice",
  "7": "crystal_citadel",
  "8": "shadows_broken_sky",
  "9": "floating_might_have_been",
} satisfies Record<RegionCode, RegionType>;

export type FeatureCode = "G" | "V" | "J" | "B";

export const FEATURE_BY_CODE = {
  G: "gate",
  V: "void",
  J: "jailor_citadel",
  B: "black_star",
} satisfies Record<FeatureCode, Exclude<TileFeature, null>>;

// Minimal registry – sync ho používá pro validaci regionů
export const REGIONS = {
  mountains_doubt: true,
  river_despair: true,
  wastelands_ash_dust: true,
  forest_decay: true,
  great_depths: true,
  planes_fire_ice: true,
  crystal_citadel: true,
  shadows_broken_sky: true,
  floating_might_have_been: true,
  void_heart: true,
} as const;

type RegionColors = { border: string; fill: string };

// UI-only: barvy a pozadí podle levelu
const REGION_UI: Record<
  RegionType,
  { colors: RegionColors; levelBg: [string, string, string] }
> = {
  mountains_doubt: {
    colors: { border: "#64748b", fill: "#64748b" },
    levelBg: ["#0a0f16", "#0c1623", "#0f2033"],
  },
  river_despair: {
    colors: { border: "#a78bfa", fill: "#a78bfa" },
    levelBg: ["#150b24", "#24104a", "#35106b"],
  },
  wastelands_ash_dust: {
    colors: { border: "#f59e0b", fill: "#f59e0b" },
    levelBg: ["#1a1206", "#2a1a07", "#3a2408"],
  },
  forest_decay: {
    colors: { border: "#22c55e", fill: "#22c55e" },
    levelBg: ["#07140b", "#0a1f10", "#0d2c17"],
  },
  great_depths: {
    colors: { border: "#14b8a6", fill: "#14b8a6" },
    levelBg: ["#061a18", "#072523", "#083330"],
  },
  planes_fire_ice: {
    colors: { border: "#fb7185", fill: "#fb7185" },
    levelBg: ["#1a0508", "#2a070b", "#3a0a10"],
  },
  crystal_citadel: {
    colors: { border: "#38bdf8", fill: "#38bdf8" },
    levelBg: ["#0b1220", "#0b1f34", "#0c2f4f"],
  },
  shadows_broken_sky: {
    colors: { border: "#94a3b8", fill: "#94a3b8" },
    levelBg: ["#0a0f14", "#0e141d", "#121c29"],
  },
  floating_might_have_been: {
    colors: { border: "#f472b6", fill: "#f472b6" },
    levelBg: ["#160612", "#24091c", "#360b2a"],
  },
  void_heart: {
    colors: { border: "#ef4444", fill: "#ef4444" },
    levelBg: ["#140507", "#1f070a", "#2d0a0e"],
  },
};

export function regionColors(region: RegionType): RegionColors {
  return REGION_UI[region]?.colors ?? { border: "#64748b", fill: "#64748b" };
}

export function levelBg(region: RegionType, level: number): string {
  const L = Math.max(0, Math.min(3, Math.floor(level)));
  if (L === 0) return "#050608";
  const def = REGION_UI[region];
  return def ? def.levelBg[L - 1] : "#050608";
}

// --- progression tiers (used for gating / ordering) ---
const regionGroups: Record<RegionType, RegionGroup> = {
  mountains_doubt: "wastelands",
  wastelands_ash_dust: "wastelands",
  forest_decay: "wastelands",
  planes_fire_ice: "wastelands",

  river_despair: "river",

  crystal_citadel: "citadel",
  shadows_broken_sky: "citadel",
  floating_might_have_been: "citadel",

  great_depths: "depths",

  void_heart: "void",
};

const groupTier: Record<RegionGroup, number> = {
  wastelands: 1,
  river: 1,
  citadel: 1,
  depths: 2,
  void: 3,
};

export function regionTier(region: RegionType): number {
  return groupTier[regionGroups[region]];
}

/** Regions that are hard-locked until a gate is opened. */
export function isRegionLockedByDefault(region: RegionType): boolean {
  const g = regionGroups[region];
  return g === "depths" || g === "void";
}

// --- activities allowed per region ---

/**
 * NOTE:
 * - "meditation" is kept for backwards-compat.
 * - "habit" and "income" are intentionally NOT allowed here (separate mechanics).
 */
const ALLOWED_BY_REGION: Record<RegionType, ActivityType[]> = {
  // Starting realm: allow all core activities so the player is never "blocked".
  mountains_doubt: ["work", "study", "sport", "mindfulness", "meditation"],

  // Physical realms
  wastelands_ash_dust: ["sport"],
  forest_decay: ["sport"],
  planes_fire_ice: ["sport"],

  // Mind realms
  river_despair: ["mindfulness", "meditation"],

  // Craft/knowledge realms
  shadows_broken_sky: ["work"],
  crystal_citadel: ["study"],
  floating_might_have_been: ["study"],

  // Endgame realms
  great_depths: ["work", "sport"],
  void_heart: ["work", "study", "sport", "mindfulness", "meditation"],
};

export function allowedActivitiesForRegion(region: RegionType): ActivityType[] {
  return (
    ALLOWED_BY_REGION[region] ?? [
      "work",
      "study",
      "sport",
      "mindfulness",
      "meditation",
    ]
  );
}

// --- unlock tiers ---

/**
 * Regions are grouped into unlock tiers.
 * Tier 1 is the "outer ring" and is unlockable without special gates.
 */
export function regionUnlockTier(region: RegionType): number {
  return groupTier[regionGroups[region]];
}

export function regionDifficultyMult(region: RegionType): number {
  // 1.0 = baseline; >1 těžší (pomalejší progres / dražší unlock), <1 lehčí
  // Uprav si hodnoty dle toho, jak chceš "difficulty curve" přes mapu.
  switch (region) {
    case "mountains_doubt":
      return 1.0;
    case "river_despair":
      return 1.1;
    case "wastelands_ash_dust":
      return 1.05;
    case "forest_decay":
      return 1.15;
    case "great_depths":
      return 1.25;
    case "planes_fire_ice":
      return 1.2;
    case "crystal_citadel":
      return 0.95; // start hub trochu lehčí
    case "shadows_broken_sky":
      return 1.3;
    case "floating_might_have_been":
      return 1.35;
    case "void_heart":
      return 1.6; // endgame
    default:
      return 1.0;
  }
}

const REGION_LABELS: Record<RegionType, string> = {
  mountains_doubt: "Mountains of Doubt",
  river_despair: "River of Despair",
  wastelands_ash_dust: "Ash Wastelands",
  forest_decay: "Forest of Decay",
  great_depths: "Great Depths",
  planes_fire_ice: "Plains of Fire & Ice",
  crystal_citadel: "Crystal Citadel",
  shadows_broken_sky: "Shadows of Broken Sky",
  floating_might_have_been: "Might-Have-Been",
  void_heart: "Void Heart",
};

export function regionLabel(region: RegionType): string {
  return REGION_LABELS[region] ?? String(region);
}
