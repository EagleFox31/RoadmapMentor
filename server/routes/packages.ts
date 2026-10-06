import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, requireLearner, type AuthRequest } from "../auth";
import { createMentoringPackageSchema, insertMentoringPackageSchema, createChangeRequestSchema, insertChangeRequestSchema, quoteChangeRequestSchema, changeRequestDecisionSchema } from "@shared/schema";
import { assertChangeRequestTransition, requiresLinkedRoadmapWork } from "../domain/changeRequest";
import { handleError } from "../http/errors";
import { getMentorshipAccess, validateTaskBelongsToMentorshipRoadmap } from "../access/mentorshipAccess";
import { reconcileBillingPeriod } from "../services/billingPeriods";

export function registerMentoringPackageRoutes(app: Express) {
  app.get(
    "/api/mentorships/:id/packages",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const packages = await storage.getMentoringPackagesByMentorship(
          mentorshipId,
        );
        res.json(packages);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/packages",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = createMentoringPackageSchema.parse(req.body);
        const packageData = insertMentoringPackageSchema.parse({
          mentorshipId,
          title: input.title,
          basePriceMinor: input.basePriceMinor,
          currency: input.currency,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          includedSessionCount: input.includedSessionCount,
          includedSessionDurationMinutes:
            input.includedSessionDurationMinutes ?? null,
          sessionSchedule: input.sessionSchedule ?? null,
          scopeDescription: input.scopeDescription,
          createdByUserId: req.user!.id,
        });

        const mentoringPackage = await storage.createMentoringPackageWithScope(
          packageData,
          input.scopeItems.map(
            (scopeItem: { title: string; description?: string | null }) => ({
              title: scopeItem.title,
              description: scopeItem.description ?? null,
            }),
          ),
        );

        res.status(201).json(mentoringPackage);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.get(
    "/api/mentorships/:id/change-requests",
    authMiddleware,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const requests = await storage.getChangeRequestsByMentorship(
          mentorshipId,
        );
        res.json(requests);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/change-requests",
    authMiddleware,
    requireLearner,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || access.mentorship?.learnerId !== req.user!.id) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = createChangeRequestSchema.parse(req.body);
        const mentoringPackage = await storage.getMentoringPackage(input.packageId);
        if (
          !mentoringPackage ||
          mentoringPackage.mentorshipId !== mentorshipId
        ) {
          return res.status(400).json({
            error: "packageId must belong to this mentorship",
          });
        }

        const changeRequestData = insertChangeRequestSchema.parse({
          mentorshipId,
          packageId: mentoringPackage.id,
          requestedByUserId: req.user!.id,
          title: input.title,
          description: input.description,
          status: "PROPOSED",
          quotedPriceMinor: null,
          currency: mentoringPackage.currency,
          linkedTaskId: null,
        });

        const changeRequest = await storage.createChangeRequest(
          changeRequestData,
        );
        res.status(201).json(changeRequest);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/quote",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Change request not found" });
        }

        assertChangeRequestTransition(changeRequest.status, "QUOTED");
        const input = quoteChangeRequestSchema.parse(req.body);

        if (
          !(await validateTaskBelongsToMentorshipRoadmap(
            changeRequest.mentorshipId,
            input.linkedTaskId,
          ))
        ) {
          return res.status(400).json({
            error: "linkedTaskId must belong to the mentorship roadmap",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: "QUOTED",
          quotedPriceMinor: input.quotedPriceMinor,
          currency: input.currency,
          linkedTaskId: input.linkedTaskId,
          quotedAt: new Date(),
        });

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/decision",
    authMiddleware,
    requireLearner,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (
          !access.allowed ||
          access.mentorship?.learnerId !== req.user!.id
        ) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const input = changeRequestDecisionSchema.parse(req.body);
        const nextStatus =
          input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

        assertChangeRequestTransition(changeRequest.status, nextStatus);

        if (
          requiresLinkedRoadmapWork(nextStatus) &&
          !changeRequest.linkedTaskId
        ) {
          return res.status(409).json({
            error:
              "Accepted scope changes must be linked to roadmap work before approval",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: nextStatus,
          acceptedAt: nextStatus === "ACCEPTED" ? new Date() : null,
          rejectedAt: nextStatus === "REJECTED" ? new Date() : null,
        });

        if (nextStatus === "ACCEPTED" && changeRequest.packageId) {
          const billingPeriod = await storage.findBillingPeriodByPackage(
            changeRequest.packageId,
          );
          if (billingPeriod) {
            await reconcileBillingPeriod(billingPeriod);
          }
        }

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/change-requests/:id/deliver",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const changeRequestId = Number(req.params.id);
        const changeRequest = Number.isInteger(changeRequestId)
          ? await storage.getChangeRequest(changeRequestId)
          : undefined;

        if (!changeRequest) {
          return res.status(404).json({ error: "Change request not found" });
        }

        const access = await getMentorshipAccess(
          req,
          changeRequest.mentorshipId,
        );
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Change request not found" });
        }

        assertChangeRequestTransition(changeRequest.status, "DELIVERED");
        if (!changeRequest.linkedTaskId) {
          return res.status(409).json({
            error: "Delivered scope changes must remain linked to roadmap work",
          });
        }

        const updated = await storage.updateChangeRequest(changeRequest.id, {
          status: "DELIVERED",
          deliveredAt: new Date(),
        });

        res.json(updated);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Invalid change request transition")
        ) {
          return res.status(409).json({ error: error.message });
        }
        handleError(res, error);
      }
    },
  );
}
