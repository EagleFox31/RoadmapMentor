export const ROADMAP_MILESTONES = [25, 50, 75, 100] as const;

export function completionPercentage(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((completed / total) * 100);
}

/** Jalons franchis en passant de `previous` à `current` (en %). */
export function crossedMilestones(previous: number, current: number): number[] {
  return ROADMAP_MILESTONES.filter(
    (milestone) => previous < milestone && current >= milestone,
  );
}
