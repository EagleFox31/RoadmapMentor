import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { insertRoadmapSchema, insertMentorshipSchema } from "@shared/schema";
import { handleError } from "../http/errors";

export function registerRoadmapRoutes(app: Express) {
  app.get("/api/roadmaps", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const roadmaps = await storage.getRoadmapsForUser(
        req.user!.id,
        req.user!.role,
      );
      res.json(roadmaps);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/roadmaps/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const roadmapId = parseInt(req.params.id, 10);
      const roadmap = await storage.getRoadmap(roadmapId);
      if (
        !roadmap ||
        !(await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId))
      ) {
        return res.status(404).json({ error: "Roadmap not found" });
      }

      res.json(roadmap);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/roadmaps", authMiddleware, requireMentor, async (req: AuthRequest, res) => {
    try {
      const roadmapData = insertRoadmapSchema.parse({
        ...req.body,
        createdByUserId: req.user!.id,
        isLegacy: false,
      });
      const roadmap = await storage.createRoadmap(roadmapData);
      res.status(201).json(roadmap);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/mentorships", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const accessibleRoadmaps = await storage.getRoadmapsForUser(
        req.user!.id,
        req.user!.role,
      );

      const entries = [];
      for (const roadmap of accessibleRoadmaps) {
        const memberships = await storage.getMentorshipsByRoadmap(roadmap.id);

        for (const mentorship of memberships) {
          const belongsToCurrentUser =
            req.user!.role === "MENTOR"
              ? mentorship.mentorId === req.user!.id ||
                roadmap.createdByUserId === req.user!.id
              : mentorship.learnerId === req.user!.id;

          if (!belongsToCurrentUser || mentorship.status === "CANCELLED") {
            continue;
          }

          const [mentor, learner] = await Promise.all([
            storage.getUser(mentorship.mentorId),
            storage.getUser(mentorship.learnerId),
          ]);

          entries.push({
            ...mentorship,
            roadmap: {
              id: roadmap.id,
              title: roadmap.title,
              description: roadmap.description,
            },
            mentor: mentor
              ? {
                  id: mentor.id,
                  fullName: mentor.fullName,
                  email: mentor.email,
                }
              : null,
            learner: learner
              ? {
                  id: learner.id,
                  fullName: learner.fullName,
                  email: learner.email,
                }
              : null,
          });
        }
      }

      res.json(entries);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get(
    "/api/roadmaps/:id/mentorships",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        const memberships = await storage.getMentorshipsByRoadmap(roadmapId);
        res.json(memberships);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/roadmaps/:id/mentorships",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (
          !(await storage.userCanAccessRoadmap(
            req.user!.id,
            req.user!.role,
            roadmapId,
          ))
        ) {
          return res.status(404).json({ error: "Roadmap not found" });
        }

        const learnerId = Number(req.body.learnerId);
        const learner = Number.isInteger(learnerId)
          ? await storage.getUser(learnerId)
          : undefined;

        if (!learner || learner.role !== "LEARNER") {
          return res.status(400).json({ error: "A valid learnerId is required" });
        }

        const existing = await storage.findMentorship(
          roadmapId,
          req.user!.id,
          learnerId,
        );
        if (existing) {
          return res.status(200).json(existing);
        }

        const mentorshipData = insertMentorshipSchema.parse({
          roadmapId,
          mentorId: req.user!.id,
          learnerId,
          status: "ACTIVE",
          startedAt: new Date(),
          endedAt: null,
        });

        const mentorship = await storage.createMentorship(mentorshipData);
        res.status(201).json(mentorship);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // Exact-email lookup used by mentors to attach a learner to a roadmap.
  // Only LEARNER accounts are returned; any other outcome is an indistinguishable 404.
  app.get(
    "/api/learners/lookup",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const email =
          typeof req.query.email === "string" ? req.query.email.trim() : "";
        if (!email || !email.includes("@")) {
          return res.status(400).json({ error: "A valid email is required" });
        }

        const user = (await storage.getUserByEmail(email)) ?? (await storage.getUserByEmail(email.toLowerCase()));
        if (!user || user.role !== "LEARNER") {
          return res.status(404).json({ error: "Learner not found" });
        }

        res.json({ id: user.id, fullName: user.fullName, email: user.email });
      } catch (error) {
        handleError(res, error);
      }
    },
  );
}
