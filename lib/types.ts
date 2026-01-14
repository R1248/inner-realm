export type ActivityType = "work" | "study" | "meditation" | "sport" | "habit";
export type RegionType = "citadel" | "river" | "wastelands";

export type Tile = {
  id: string;          
  row: number;
  col: number;
  region: RegionType;
  level: number;      
};

export type Session = {
  id: string;
  createdAt: number;
  activity: ActivityType;
  minutes: number;
  note?: string | null;
};