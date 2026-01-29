import type { ActivityType } from "./types";
import { isCoreActivity, resourceGainsForSession } from "./resourceModel";

export function estimateRewards(activity: ActivityType, minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes || 0));
  const xp = isCoreActivity(activity) ? safeMinutes : 0;
  const resources = resourceGainsForSession({ activity, minutes: safeMinutes });
  return { xp, resources };
}
