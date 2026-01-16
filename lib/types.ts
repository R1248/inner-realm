export type ActivityType = "work" | "study" | "meditation" | "sport" | "habit";

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

export type TileFeature = "gate" | "void" | "jailor_citadel" | "black_star" | null;

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
};
