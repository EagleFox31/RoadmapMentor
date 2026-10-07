import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { createInvitationSchema } from "@shared/schema";
import { handleError } from "../http/errors";
import type { RouteDeps } from "./deps";
import {
  acceptInvitation,
  describeInvitation,
  inviteLearner,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from "../services/invitations";

export function registerInvitationRoutes(app: Express, { limiters }: RouteDeps) {
  const mentorRoadmapAccess = async (req: AuthRequest, roadmapId: number) =>
    Number.isInteger(roadmapId) &&
    (await storage.userCanAccessRoadmap(req.user!.id, req.user!.role, roadmapId));

  app.post(
    "/api/roadmaps/:id/invitations",
    authMiddleware,
    requireMentor,
    limiters.invitation,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (!(await mentorRoadmapAccess(req, roadmapId))) {
          return res.status(404).json({ error: "Roadmap not found" });
        }
        const { email } = createInvitationSchema.parse(req.body);
        const mentor = await storage.getUser(req.user!.id);
        const result = await inviteLearner(mentor!, roadmapId, email);
        if (result.outcome === "attached") {
          return res.status(result.created ? 201 : 200).json(result);
        }
        res.status(201).json(result);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.get(
    "/api/roadmaps/:id/invitations",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const roadmapId = parseInt(req.params.id, 10);
        if (!(await mentorRoadmapAccess(req, roadmapId))) {
          return res.status(404).json({ error: "Roadmap not found" });
        }
        res.json(await listInvitations(req.user!.id, roadmapId));
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/invitations/:id/resend",
    authMiddleware,
    requireMentor,
    limiters.invitation,
    async (req: AuthRequest, res) => {
      try {
        const mentor = await storage.getUser(req.user!.id);
        res.json(await resendInvitation(mentor!, parseInt(req.params.id, 10)));
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.delete(
    "/api/invitations/:id",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        res.json(await revokeInvitation(req.user!.id, parseInt(req.params.id, 10)));
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.get("/api/invitations/token/:token", limiters.auth, async (req, res) => {
    try {
      res.json(await describeInvitation(req.params.token));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/invitations/token/:token/accept", limiters.auth, async (req, res) => {
    try {
      res.status(201).json(await acceptInvitation(req.params.token, req.body));
    } catch (error) {
      handleError(res, error);
    }
  });
}
