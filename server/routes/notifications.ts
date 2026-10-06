import { type Express } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { updateEmailNotificationPreferencesSchema } from "@shared/schema";
import { handleError } from "../http/errors";
import type { RouteDeps } from "./deps";

export function registerNotificationRoutes(app: Express, { limiters }: RouteDeps) {
  app.post("/api/test/email-notifications", authMiddleware, requireMentor, async (req, res) => {
    try {
      const { testEmailNotifications } = await import("../jobs/emailNotifications");
      await testEmailNotifications();
      res.json({ message: "Email notifications test completed. Check server logs for details." });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Route pour envoyer manuellement les rappels de tâches
  app.post("/api/jobs/send-task-reminders", authMiddleware, requireMentor, limiters.jobs, async (_req, res) => {
    try {
      const { emailService } = await import("../services/emailService");
      const learners = await emailService.getAllLearners();

      let sentCount = 0;
      let skippedCount = 0;

      for (const learner of learners) {
        const learnerWeeks = (
          await storage.getAccessibleWeeks(learner.id, "LEARNER")
        ).filter((week) => week.isValidatedByMentor);

        for (const week of learnerWeeks) {
          const objectives = await storage.getObjectivesByWeek(week.id);
          let pendingTasksCount = 0;

          for (const objective of objectives) {
            const tasks = await storage.getTasksByObjective(objective.id);
            for (const task of tasks) {
              const progress = await storage.getTaskProgress(task.id, learner.id);
              if (!progress || !progress.isDone) {
                pendingTasksCount++;
              }
            }
          }

          if (pendingTasksCount > 0) {
            const sent = await emailService.sendTaskReminder(
              learner.id,
              learner.email,
              learner.fullName,
              week.number,
              pendingTasksCount,
            );

            if (sent) {
              sentCount++;
            } else {
              skippedCount++;
            }
          }
        }
      }

      res.json({
        message: "Task reminders sent successfully.",
        sent: sentCount,
        skipped: skippedCount,
        learners: learners.length,
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/email-preferences", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      let preferences = await storage.getEmailPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist (all enabled by default)
        preferences = await storage.createEmailPreferences({
          userId,
          // Existing preferences
          taskReminders: true,
          weekPreparation: true,
          progressUpdates: true,
          commentNotifications: true,
          // AI/System notifications
          aiGenerationNotifications: true,
          weekValidationNotifications: true,
          // Collaboration notifications
          newTaskNotifications: true,
          screenshotNotifications: true,
          weekModifiedNotifications: true,
          // Intelligent reminders
          deadlineReminders: true,
          streakWarnings: true,
          // Gamification
          milestoneNotifications: true,
          badgeNotifications: true,
          weeklyReports: true,
        });
      }
      
      res.json(preferences);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/email-preferences", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const parsed = updateEmailNotificationPreferencesSchema.safeParse(req.body);

      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return res.status(400).json({
          error: "Invalid email preference update",
          details: parsed.success ? undefined : parsed.error.flatten(),
        });
      }

      const preferences = await storage.updateEmailPreferences(userId, parsed.data);
      res.json(preferences);
    } catch (error) {
      handleError(res, error);
    }
  });
}
