import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { type AuthRequest } from "../auth";
import { type Week } from "@shared/schema";

export const canAccessWeek = async (req: AuthRequest, weekId: number) => {
  const week = await storage.getWeek(weekId);
  if (!week) {
    return { week: undefined, allowed: false };
  }

  // Transitional compatibility: pre-domain weeks stay reachable until the
  // explicit legacy migration attaches them to the legacy roadmap.
  // Learners only see weeks validated by a mentor (same rule as GET /api/weeks).
  const hiddenFromLearner =
    req.user!.role === "LEARNER" && !week.isValidatedByMentor;

  if (week.roadmapId === null) {
    return { week, allowed: !hiddenFromLearner };
  }

  const allowed =
    !hiddenFromLearner &&
    (await storage.userCanAccessRoadmap(
      req.user!.id,
      req.user!.role,
      week.roadmapId,
    ));
  return { week, allowed };
};

export const resolveRoadmapIdForNewWeek = async (
  req: AuthRequest,
  requestedRoadmapId: unknown,
): Promise<number | null> => {
  if (requestedRoadmapId !== undefined && requestedRoadmapId !== null) {
    const roadmapId = Number(requestedRoadmapId);
    if (!Number.isInteger(roadmapId) || roadmapId <= 0) {
      throw new Error("roadmapId must be a positive integer");
    }

    if (!(await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId))) {
      throw new Error("Roadmap not found");
    }
    return roadmapId;
  }

  const accessibleRoadmaps = await storage.getRoadmapsForUser(
    req.user!.id,
    req.user!.role,
  );

  if (accessibleRoadmaps.length === 1) {
    return accessibleRoadmaps[0].id;
  }

  if (accessibleRoadmaps.length > 1) {
    throw new Error("roadmapId is required when more than one roadmap is accessible");
  }

  return null;
};

export const getMentorsForWeek = async (week: Week) => {
  if (week.roadmapId === null) {
    return await emailService.getAllMentors();
  }

  const roadmap = await storage.getRoadmap(week.roadmapId);
  const memberships = await storage.getMentorshipsByRoadmap(week.roadmapId);
  const mentorIds = new Set(
    memberships
      .filter((membership) => membership.status !== "CANCELLED")
      .map((membership) => membership.mentorId),
  );

  if (roadmap?.createdByUserId) {
    mentorIds.add(roadmap.createdByUserId);
  }

  const mentors = await Promise.all(
    Array.from(mentorIds).map((mentorId) => storage.getUser(mentorId)),
  );

  return mentors.filter(
    (mentor): mentor is NonNullable<typeof mentor> =>
      Boolean(mentor && mentor.role === "MENTOR"),
  );
};

export const getLearnerIdsForWeek = async (week: Week): Promise<Set<number> | null> => {
  if (week.roadmapId === null) {
    return null;
  }

  const memberships = await storage.getMentorshipsByRoadmap(week.roadmapId);
  return new Set(
    memberships
      .filter((membership) => membership.status !== "CANCELLED")
      .map((membership) => membership.learnerId),
  );
};

export const getObjectiveAccess = async (req: AuthRequest, objectiveId: number) => {
  const objective = await storage.getObjective(objectiveId);
  if (!objective) {
    return { objective: undefined, week: undefined, allowed: false };
  }

  const weekAccess = await canAccessWeek(req, objective.weekId);
  return {
    objective,
    week: weekAccess.week,
    allowed: weekAccess.allowed,
  };
};

export const getTaskAccess = async (req: AuthRequest, taskId: number) => {
  const task = await storage.getTask(taskId);
  if (!task) {
    return {
      task: undefined,
      objective: undefined,
      week: undefined,
      allowed: false,
    };
  }

  const objectiveAccess = await getObjectiveAccess(req, task.objectiveId);
  return {
    task,
    objective: objectiveAccess.objective,
    week: objectiveAccess.week,
    allowed: objectiveAccess.allowed,
  };
};

export const getDeliverableAccess = async (req: AuthRequest, deliverableId: number) => {
  const deliverable = await storage.getDeliverable(deliverableId);
  if (!deliverable) {
    return { deliverable: undefined, week: undefined, allowed: false };
  }

  const weekAccess = await canAccessWeek(req, deliverable.weekId);
  return {
    deliverable,
    week: weekAccess.week,
    allowed: weekAccess.allowed,
  };
};

export const getResourceAccess = async (req: AuthRequest, resourceId: number) => {
  const resource = await storage.getResource(resourceId);
  if (!resource) {
    return { resource: undefined, week: undefined, allowed: false };
  }

  const weekAccess = await canAccessWeek(req, resource.weekId);
  return {
    resource,
    week: weekAccess.week,
    allowed: weekAccess.allowed,
  };
};

export const getLabAccess = async (req: AuthRequest, labId: number) => {
  const lab = await storage.getLab(labId);
  if (!lab) {
    return { lab: undefined, week: undefined, allowed: false };
  }

  const weekAccess = await canAccessWeek(req, lab.weekId);
  const hiddenDraft = req.user!.role === "LEARNER" && !lab.isPublished;
  return {
    lab,
    week: weekAccess.week,
    allowed: weekAccess.allowed && !hiddenDraft,
  };
};
