import type { ActivityType, RegionType, TileFeature } from "../types";

/**
 * Central registry for region metadata + rules.
 *
 * Keep UI colors, progression multipliers, and activity constraints in one place.
 * This prevents drift when you add new regions (types updated, but UI/store still use legacy ones).
 */

export type RegionGroup = "wastelands" | "river" | "citadel" | "void";

export type RegionDef = {
  id: RegionType;
  label: string;
  group: RegionGroup;

  /** Higher tier = later / harder content (used for auto-pick ordering). */
  tier: number;

  /** Multiplies required minutes per level segment. 1.0 = baseline. */
  difficultyMult: number;

  colors: { border: string; fill: string };

  /** Background shades for levels 1..3 (level 0 is handled elsewhere). */
  levelBg: [string, string, string];

  /** If undefined, defaults to the group's allowed activities. */
  allowedActivities?: ActivityType[];

  /** If true, tiles in this region start as locked (seed logic should respect this). */
  defaultLocked?: boolean;
};

export const GROUP_ALLOWED_ACTIVITIES: Record<RegionGroup, ActivityType[]> = {
  wastelands: ["sport", "habit"],
  river: ["meditation"],
  citadel: ["work", "study"],
  void: ["work", "study", "meditation", "sport", "habit"],
};

/**
 * NOTE: Hex colors are intentionally hard-coded (dark UI + consistent shades).
 * You can later move these into theme tokens.
 */
export const REGIONS = {
  mountains_doubt: {
    id: "mountains_doubt",
    label: "Mountains of Doubt",
    group: "wastelands",
    tier: 1,
    difficultyMult: 0.9,
    colors: { border: "#64748b", fill: "#64748b" },
    levelBg: ["#0a0f16", "#0c1623", "#0f2033"],
  },

  river_despair: {
    id: "river_despair",
    label: "River of Despair",
    group: "river",
    tier: 2,
    difficultyMult: 1.1,
    colors: { border: "#a78bfa", fill: "#a78bfa" },
    levelBg: ["#150b24", "#24104a", "#35106b"],
  },

  wastelands_ash_dust: {
    id: "wastelands_ash_dust",
    label: "Wastelands of Ash & Dust",
    group: "wastelands",
    tier: 1,
    difficultyMult: 0.75,
    colors: { border: "#f59e0b", fill: "#f59e0b" },
    levelBg: ["#1a1206", "#2a1a07", "#3a2408"],
  },

  forest_decay: {
    id: "forest_decay",
    label: "Forest of Decay",
    group: "wastelands",
    tier: 2,
    difficultyMult: 1.0,
    colors: { border: "#22c55e", fill: "#22c55e" },
    levelBg: ["#07140b", "#0a1f10", "#0d2c17"],
  },

  great_depths: {
    id: "great_depths",
    label: "The Great Depths",
    group: "wastelands",
    tier: 3,
    difficultyMult: 1.25,
    colors: { border: "#14b8a6", fill: "#14b8a6" },
    levelBg: ["#061a18", "#072523", "#083330"],
    defaultLocked: true,
  },

  planes_fire_ice: {
    id: "planes_fire_ice",
    label: "Planes of Fire & Ice",
    group: "wastelands",
    tier: 3,
    difficultyMult: 1.35,
    colors: { border: "#fb7185", fill: "#fb7185" },
    levelBg: ["#1a0508", "#2a070b", "#3a0a10"],
  },

  crystal_citadel: {
    id: "crystal_citadel",
    label: "Crystal Citadel",
    group: "citadel",
    tier: 4,
    difficultyMult: 1.5,
    colors: { border: "#38bdf8", fill: "#38bdf8" },
    levelBg: ["#0b1220", "#0b1f34", "#0c2f4f"],
  },

  shadows_broken_sky: {
    id: "shadows_broken_sky",
    label: "Shadows of the Broken Sky",
    group: "citadel",
    tier: 5,
    difficultyMult: 1.6,
    colors: { border: "#94a3b8", fill: "#94a3b8" },
    levelBg: ["#0a0f14", "#0e141d", "#121c29"],
  },

  floating_might_have_been: {
    id: "floating_might_have_been",
    label: "Floating Realm of Might-Have-Been",
    group: "citadel",
    tier: 4,
    difficultyMult: 1.7,
    colors: { border: "#f472b6", fill: "#f472b6" },
    levelBg: ["#160612", "#24091c", "#360b2a"],
  },

  void_heart: {
    id: "void_heart",
    label: "The Void Heart",
    group: "void",
    tier: 6,
    difficultyMult: 2.0,
    colors: { border: "#ef4444", fill: "#ef4444" },
    levelBg: ["#140507", "#1f070a", "#2d0a0e"],
    defaultLocked: true,
  },
} satisfies Record<RegionType, RegionDef>;

export function regionDef(region: RegionType): RegionDef {
  return REGIONS[region];
}

export function regionLabel(region: RegionType): string {
  return regionDef(region).label;
}

export function regionTier(region: RegionType): number {
  return regionDef(region).tier;
}

export function regionDifficultyMult(region: RegionType): number {
  return regionDef(region).difficultyMult;
}

export function allowedActivitiesForRegion(region: RegionType): ActivityType[] {
  const def = regionDef(region);
  return def.allowedActivities ?? GROUP_ALLOWED_ACTIVITIES[def.group];
}

export function regionColors(region: RegionType) {
  return regionDef(region).colors;
}

export function levelBg(region: RegionType, level: number) {
  const L = Math.max(0, Math.min(3, Math.floor(level)));
  if (L === 0) return "#050608";
  return regionDef(region).levelBg[L - 1];
}

export function isRegionLockedByDefault(region: RegionType): boolean {
  return !!regionDef(region).defaultLocked;
}

// ---- Layout decoding (digits/markers) ----

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
