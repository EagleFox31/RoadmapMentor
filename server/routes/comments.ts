import { type Express } from "express";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { authMiddleware, requireLearner, type AuthRequest } from "../auth";
import { insertWeekCommentSchema, type Week } from "@shared/schema";
import { handleError } from "../http/errors";
import { canAccessWeek, getMentorsForWeek, getLearnerIdsForWeek } from "../access/weekAccess";

export function registerCommentRoutes(app: Express) {
  app.post("/api/weeks/:weekId/comments", authMiddleware, requireLearner, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const weekAccess = await canAccessWeek(req, weekId);
      if (!weekAccess.week || !weekAccess.allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const commentData = insertWeekCommentSchema.parse({
        ...req.body,
        weekId,
        learnerId: req.user!.id,
      });
      const comment = await storage.createComment(commentData);
      const learner = await storage.getUser(comment.learnerId);

      if (learner) {
        const mentors = await getMentorsForWeek(weekAccess.week);
        for (const mentor of mentors) {
          await emailService.sendCommentNotification(
            mentor.id,
            mentor.email,
            mentor.fullName,
            learner.fullName,
            weekAccess.week.number,
            comment.content,
          );
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/weeks/:weekId/comments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const weekId = parseInt(req.params.weekId, 10);
      const weekAccess = await canAccessWeek(req, weekId);
      if (!weekAccess.week || !weekAccess.allowed) {
        return res.status(404).json({ error: "Week not found" });
      }

      const comments = await storage.getCommentsByWeek(weekId);
      if (req.user!.role === "LEARNER") {
        return res.json(
          comments.filter((comment) => comment.learnerId === req.user!.id),
        );
      }

      const roadmapLearnerIds = await getLearnerIdsForWeek(weekAccess.week);
      res.json(
        roadmapLearnerIds === null
          ? comments
          : comments.filter((comment) =>
              roadmapLearnerIds.has(comment.learnerId),
            ),
      );
    } catch (error) {
      handleError(res, error);
    }
  });
}
