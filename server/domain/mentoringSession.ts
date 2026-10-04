export type MentoringSessionStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export function canFinalizeMentoringSession(
  current: MentoringSessionStatus,
): boolean {
  return current === "SCHEDULED";
}

export function finalStatusForAttendance(
  learnerAttended: boolean,
): MentoringSessionStatus {
  return learnerAttended ? "COMPLETED" : "NO_SHOW";
}
