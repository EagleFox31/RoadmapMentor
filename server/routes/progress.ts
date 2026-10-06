import { type Express } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { authMiddleware, requireLearner, type AuthRequest } from "../auth";
import { ObjectStorageService } from "../objectStorage";
import { handleError } from "../http/errors";
import { getMentorsForWeek, getLearnerIdsForWeek, getTaskAccess } from "../access/weekAccess";

export function registerProgressRoutes(app: Express) {
  app.post("/api/tasks/:taskId/toggle-progress", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const authenticatedLearnerId = req.user!.id;
      const taskId = parseInt(req.params.taskId, 10);
      const taskAccess = await getTaskAccess(req, taskId);

      if (
        !taskAccess.task ||
        !taskAccess.objective ||
        !taskAccess.week ||
        !taskAccess.allowed
      ) {
        return res.status(404).json({ error: "Task not found" });
      }

      const { screenshotUrl } = req.body;
      let normalizedScreenshotUrl = screenshotUrl;

      if (screenshotUrl) {
        const objectStorageService = new ObjectStorageService();
        normalizedScreenshotUrl =
          await objectStorageService.trySetObjectEntityAclPolicy(
            screenshotUrl,
            {
              owner: authenticatedLearnerId.toString(),
              visibility: "public",
            },
          );
      }

      const progress = await storage.toggleTaskProgress(
        taskId,
        authenticatedLearnerId,
        normalizedScreenshotUrl,
      );

      if (progress.isDone || normalizedScreenshotUrl) {
        const learner = await storage.getUser(authenticatedLearnerId);
        if (learner) {
          const mentors = await getMentorsForWeek(taskAccess.week);

          if (normalizedScreenshotUrl && progress.isDone) {
            for (const mentor of mentors) {
              await emailService
                .sendScreenshotUploaded(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  taskAccess.task.label,
                  taskAccess.week.number,
                )
                .catch((err) =>
                  console.error("Failed to send screenshot notification:", err),
                );
            }
          }

          if (progress.isDone) {
            const allObjectives = await storage.getObjectivesByWeek(
              taskAccess.week.id,
            );
            let totalTasks = 0;
            let completedTasks = 0;

            for (const objective of allObjectives) {
              const tasks = await storage.getTasksByObjective(objective.id);
              totalTasks += tasks.length;

              for (const task of tasks) {
                const learnerProgress = await storage.getTaskProgress(
                  task.id,
                  authenticatedLearnerId,
                );
                if (learnerProgress?.isDone) {
                  completedTasks++;
                }
              }
            }

            const completionPercentage =
              totalTasks > 0
                ? Math.round((completedTasks / totalTasks) * 100)
                : 0;

            for (const mentor of mentors) {
              await emailService
                .sendProgressUpdate(
                  mentor.id,
                  mentor.email,
                  mentor.fullName,
                  learner.fullName,
                  taskAccess.week.number,
                  completionPercentage,
                )
                .catch((err) =>
                  console.error("Failed to send progress update:", err),
                );
            }
          }
        }
      }

      res.json(progress);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/progress/summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let weeks = await storage.getAccessibleWeeks(
        req.user!.id,
        req.user!.role,
      );
      if (req.query.roadmapId !== undefined) {
        const roadmapId = Number(req.query.roadmapId);
        if (!Number.isInteger(roadmapId) || roadmapId <= 0) {
          return res.status(400).json({ error: "roadmapId must be a positive integer" });
        }
        if (!(await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId))) {
          return res.status(404).json({ error: "Roadmap not found" });
        }
        weeks = weeks.filter((week) => week.roadmapId === roadmapId);
      }
      let totalTasks = 0;
      let completedTasks = 0;

      if (req.user!.role === "LEARNER") {
        const authenticatedLearnerId = req.user!.id;
        weeks = weeks.filter((week) => week.isValidatedByMentor);

        for (const week of weeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const progress = await storage.getTaskProgress(
                task.id,
                authenticatedLearnerId,
              );
              if (progress?.isDone) {
                completedTasks++;
              }
            }
          }
        }
      } else {
        for (const week of weeks) {
          const roadmapLearnerIds = await getLearnerIdsForWeek(week);
          const objectives = await storage.getObjectivesByWeek(week.id);

          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            totalTasks += tasks.length;

            for (const task of tasks) {
              const allProgress = await storage.getAllTaskProgress(task.id);
              const scopedProgress =
                roadmapLearnerIds === null
                  ? allProgress
                  : allProgress.filter((progress) =>
                      roadmapLearnerIds.has(progress.learnerId),
                    );

              if (scopedProgress.some((progress) => progress.isDone)) {
                completedTasks++;
              }
            }
          }
        }
      }

      const globalPercentage =
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0;

      res.json({
        globalPercentage,
        totalCompleted: completedTasks,
        totalTasks,
      });
    } catch (error) {
      handleError(res, error);
    }
  });
}
