// ---- Core domain types ----

/**
 * Activity categories.
 *
 * Notes:
 * - "meditation" is kept as a backwards-compat alias for older DB rows.
 * - "habit" and "income" are tracked, but they don't have to invest into tiles.
 */
export type CoreActivityType = "work" | "study" | "sport" | "mindfulness";
export type ActivityType = CoreActivityType | "income" | "habit" | "meditation";

// Optional activity subtypes (stored as free-form string for now)
export type SportSubtype =
  | "run"
  | "strength"
  | "swim"
  | "bike"
  | "tennis"
  | "team"
  | "hike"
  | "other";

export type MindfulnessSubtype =
  | "meditation"
  | "breathwork"
  | "lucid_dreaming"
  | "journaling"
  | "reflection"
  | "other";

export type WorkSubtype = "job" | "project" | "other";
export type StudySubtype = "school" | "self" | "other";

export type ResourceType = "craft" | "lore" | "vigor" | "clarity" | "gold";

export type RegionType =
  | "mountains_doubt"
  | "river_despair"
  | "wastelands_ash_dust"
  | "forest_decay"
  | "great_depths"
  | "planes_fire_ice"
  | "crystal_citadel"
  | "shadows_broken_sky"
  | "floating_might_have_been"
  | "void_heart";

export type TileFeature =
  | "gate"
  | "void"
  | "jailor_citadel"
  | "black_star"
  | null;

export type LockedFlag = 0 | 1;

export type Tile = {
  id: string;
  row: number;
  col: number;
  region: RegionType;

  // progression
  level: number;
  progress: number; // invested minutes (cumulative)

  // world meta
  feature: TileFeature;
  locked: LockedFlag;
};

export type Session = {
  id: string;
  createdAt: number;
  activity: ActivityType;
  minutes: number;
  note?: string | null;

  /** Optional subtype (sport run/strength..., mindfulness meditation..., etc.). */
  subtype?: string | null;

  /** Optional numeric amount (used by income later; units left to UI/locale). */
  amount?: number | null;
};

export type PlayerState = {
  xp: number;
  craft: number;
  lore: number;
  vigor: number;
  clarity: number;
  gold: number;
  targetTileId?: string | null;
};

export type TimerMode = "countdown" | "countup";
export type TimerSessionStatus = "running" | "stopped" | "committed";

export type TimerSession = {
  id: string;
  activity: ActivityType;
  mode: TimerMode;
  startedAt: number;
  endsAt: number | null;
  stoppedAt: number | null;
  status: TimerSessionStatus;
};
