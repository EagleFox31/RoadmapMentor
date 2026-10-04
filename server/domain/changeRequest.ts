export type ChangeRequestStatus =
  | "PROPOSED"
  | "QUOTED"
  | "ACCEPTED"
  | "REJECTED"
  | "DELIVERED";

const allowedTransitions: Record<ChangeRequestStatus, readonly ChangeRequestStatus[]> = {
  PROPOSED: ["QUOTED"],
  QUOTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["DELIVERED"],
  REJECTED: [],
  DELIVERED: [],
};

export function canTransitionChangeRequest(
  current: ChangeRequestStatus,
  next: ChangeRequestStatus,
): boolean {
  return allowedTransitions[current].includes(next);
}

export function assertChangeRequestTransition(
  current: ChangeRequestStatus,
  next: ChangeRequestStatus,
): void {
  if (!canTransitionChangeRequest(current, next)) {
    throw new Error(`Invalid change request transition: ${current} -> ${next}`);
  }
}

export function requiresLinkedRoadmapWork(
  next: ChangeRequestStatus,
): boolean {
  return next === "ACCEPTED" || next === "DELIVERED";
}
