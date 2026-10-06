import { storage } from "../storage";
import { type AuthRequest } from "../auth";

export const getMentorshipAccess = async (req: AuthRequest, mentorshipId: number) => {
  const mentorship = await storage.getMentorship(mentorshipId);
  if (!mentorship) {
    return { mentorship: undefined, allowed: false, canManage: false };
  }

  const roadmap = await storage.getRoadmap(mentorship.roadmapId);
  if (!roadmap) {
    return { mentorship, allowed: false, canManage: false };
  }

  if (req.user!.role === "LEARNER") {
    const allowed =
      mentorship.learnerId === req.user!.id &&
      mentorship.status !== "CANCELLED";
    return { mentorship, allowed, canManage: false };
  }

  const canManage =
    mentorship.mentorId === req.user!.id ||
    roadmap.createdByUserId === req.user!.id;

  return { mentorship, allowed: canManage, canManage };
};

export const validateTaskBelongsToMentorshipRoadmap = async (
  mentorshipId: number,
  taskId: number,
) => {
  const mentorship = await storage.getMentorship(mentorshipId);
  const task = await storage.getTask(taskId);
  if (!mentorship || !task) {
    return false;
  }

  const objective = await storage.getObjective(task.objectiveId);
  if (!objective) {
    return false;
  }

  const week = await storage.getWeek(objective.weekId);
  return Boolean(week && week.roadmapId === mentorship.roadmapId);
};
