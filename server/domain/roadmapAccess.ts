import type { Mentorship, Roadmap, User } from "@shared/schema";

export type RoadmapAccessRole = User["role"];

type RoadmapAccessRecord = Pick<
  Roadmap,
  "id" | "createdByUserId" | "isLegacy"
>;

type MentorshipAccessRecord = Pick<
  Mentorship,
  "roadmapId" | "mentorId" | "learnerId" | "status"
>;

export function hasRoadmapAccess({
  userId,
  role,
  roadmap,
  memberships,
}: {
  userId: number;
  role: RoadmapAccessRole;
  roadmap: RoadmapAccessRecord;
  memberships: MentorshipAccessRecord[];
}): boolean {
  if (
    role === "MENTOR" &&
    (roadmap.createdByUserId === userId || roadmap.isLegacy)
  ) {
    return true;
  }

  return memberships.some((membership) => {
    if (
      membership.roadmapId !== roadmap.id ||
      membership.status === "CANCELLED"
    ) {
      return false;
    }

    return role === "MENTOR"
      ? membership.mentorId === userId
      : membership.learnerId === userId;
  });
}
