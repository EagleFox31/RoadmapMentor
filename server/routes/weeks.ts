import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { insertWeekSchema, insertRoadmapBulkSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { canAccessWeek, resolveRoadmapIdForNewWeek, getLearnerIdsForWeek } from "../access/weekAccess";

export function registerWeekRoutes(app: Express) {
  app.get("/api/weeks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let weeks: Week[];
      const requestedRoadmapId = req.query.roadmapId;

      if (requestedRoadmapId !== undefined) {
        const roadmapId = Number(requestedRoadmapId);
        if (!Number.isInteger(roadmapId) || roadmapId <= 0) {
          return res.status(400).json({ error: "roadmapId must be a positive integer" });
        }

        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        weeks = await storage.getWeeksByRoadmap(roadmapId);
      } else {
        weeks = await storage.getAccessibleWeeks(
          req.user!.id,
          req.user!.role,
        );
      }

      const currentUserId = req.user!.id;
      const isLearner = req.user!.role === "LEARNER";

      if (isLearner) {
        weeks = weeks.filter((week) => week.isValidatedByMentor);
      }

      const contents = await storage.getWeekContentsByWeekIds(
        weeks.map((week) => week.id),
      );

      const groupBy = <T>(rows: T[], key: (row: T) => number) => {
        const groups = new Map<number, T[]>();
        for (const row of rows) {
          const bucket = groups.get(key(row));
          if (bucket) bucket.push(row);
          else groups.set(key(row), [row]);
        }
        return groups;
      };

      const objectivesByWeek = groupBy(contents.objectives, (o) => o.weekId);
      const tasksByObjective = groupBy(contents.tasks, (t) => t.objectiveId);
      const deliverablesByWeek = groupBy(contents.deliverables, (d) => d.weekId);
      const resourcesByWeek = groupBy(contents.resources, (r) => r.weekId);
      const commentsByWeek = groupBy(contents.comments, (c) => c.weekId);
      const progressByTask = groupBy(contents.progress, (p) => p.taskId);
      const labsByWeek = groupBy(contents.labs, (l) => l.weekId);
      const submissionsByLab = groupBy(contents.labSubmissions, (s) => s.labId);

      const learnerIdsByRoadmap = new Map<number, Set<number> | null>();
      for (const week of weeks) {
        const roadmapId = week.roadmapId;
        if (roadmapId !== null && !learnerIdsByRoadmap.has(roadmapId)) {
          learnerIdsByRoadmap.set(roadmapId, await getLearnerIdsForWeek(week));
        }
      }

      const weeksWithDetails = weeks.map((week) => {
        const roadmapLearnerIds =
          week.roadmapId === null
            ? null
            : (learnerIdsByRoadmap.get(week.roadmapId) ?? null);

        const objectivesWithTasks = (objectivesByWeek.get(week.id) ?? []).map(
          (objective) => ({
            ...objective,
            tasks: (tasksByObjective.get(objective.id) ?? []).map((task) => {
              const allProgress = progressByTask.get(task.id) ?? [];
              const progress = isLearner
                ? allProgress.filter((entry) => entry.learnerId === currentUserId)
                : roadmapLearnerIds === null
                  ? allProgress
                  : allProgress.filter((entry) =>
                      roadmapLearnerIds.has(entry.learnerId),
                    );
              return { ...task, progress };
            }),
          }),
        );

        const comments = commentsByWeek.get(week.id) ?? [];
        const scopedComments = isLearner
          ? comments.filter((comment) => comment.learnerId === currentUserId)
          : roadmapLearnerIds === null
            ? comments
            : comments.filter((comment) =>
                roadmapLearnerIds.has(comment.learnerId),
              );

        const visibleLabs = (labsByWeek.get(week.id) ?? []).filter(
          (lab) => !isLearner || lab.isPublished,
        );
        const labsWithSubmissions = visibleLabs.map((lab) => {
          const submissions = submissionsByLab.get(lab.id) ?? [];
          return {
            ...lab,
            submissions: isLearner
              ? submissions.filter((entry) => entry.learnerId === currentUserId)
              : roadmapLearnerIds === null
                ? submissions
                : submissions.filter((entry) =>
                    roadmapLearnerIds.has(entry.learnerId),
                  ),
          };
        });

        return {
          ...week,
          objectives: objectivesWithTasks,
          deliverables: deliverablesByWeek.get(week.id) ?? [],
          resources: resourcesByWeek.get(week.id) ?? [],
          labs: labsWithSubmissions,
          comments: scopedComments,
        };
      });

      res.json(weeksWithDetails);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const roadmapId = await resolveRoadmapIdForNewWeek(
        req,
        req.body.roadmapId,
      );
      const weekData = insertWeekSchema.parse({
        ...req.body,
        roadmapId,
      });
      const week = await storage.createWeek(weekData);
      res.status(201).json(week);
    } catch (error) {
      if (error instanceof Error && error.message === "Roadmap not found") {
        return res.status(404).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        (error.message.includes("roadmapId is required") ||
          error.message.includes("roadmapId must be"))
      ) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.post("/api/weeks/bulk", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRoadmapBulkSchema.parse(req.body);
      const scopedData = await Promise.all(
        validatedData.map(async (week) => ({
          ...week,
          roadmapId: await resolveRoadmapIdForNewWeek(req, week.roadmapId),
        })),
      );

      const result = await storage.createRoadmapBulk(scopedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          error: "Validation error",
          details: error.message,
        });
      }
      if (error instanceof Error && error.message === "Roadmap not found") {
        return res.status(404).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        (error.message.includes("roadmapId is required") ||
          error.message.includes("roadmapId must be"))
      ) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.put("/api/weeks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const weekData = insertWeekSchema
        .omit({ roadmapId: true })
        .partial()
        .parse(req.body);
      const week = await storage.updateWeek(weekId, weekData);
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/weeks/:id", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week, allowed } = await canAccessWeek(req, weekId);
      if (!week || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      await storage.deleteWeek(weekId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/validate", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const week = await storage.validateWeek(weekId);
      res.json(week);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/weeks/:id/clone", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.id, 10);
      const { week: existingWeek, allowed } = await canAccessWeek(req, weekId);
      if (!existingWeek || !allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const { newNumber } = req.body;
      if (typeof newNumber !== "number") {
        return res.status(400).json({
          error: "newNumber is required and must be a number",
        });
      }

      const clonedWeek = await storage.cloneWeek(weekId, newNumber);
      res.status(201).json(clonedWeek);
    } catch (error) {
      handleError(res, error);
    }
  });
}
