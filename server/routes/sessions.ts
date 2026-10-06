import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { scheduleMentoringSessionSchema, insertMentoringSessionSchema, completeMentoringSessionSchema } from "@shared/schema";
import { canFinalizeMentoringSession, finalStatusForAttendance } from "../domain/mentoringSession";
import { handleError } from "../http/errors";
import { getMentorshipAccess } from "../access/mentorshipAccess";
import { reconcileBillingPeriod } from "../services/billingPeriods";

export function registerMentoringSessionRoutes(app: Express) {
  app.get(
    "/api/mentorships/:id/sessions",
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

        const requestedMonth =
          typeof req.query.month === "string" ? req.query.month : undefined;
        if (
          requestedMonth &&
          !/^\d{4}-\d{2}$/.test(requestedMonth)
        ) {
          return res.status(400).json({ error: "month must use YYYY-MM" });
        }

        let sessions = await storage.getMentoringSessionsByMentorship(
          mentorshipId,
        );
        if (requestedMonth) {
          sessions = sessions.filter(
            (session) =>
              session.startsAt.toISOString().slice(0, 7) === requestedMonth,
          );
        }

        const packages = await storage.getMentoringPackagesByMentorship(
          mentorshipId,
        );
        const packageUsage = packages.map((mentoringPackage) => {
          const usedSessionCount = sessions.filter(
            (session) =>
              session.packageId === mentoringPackage.id &&
              !session.isAdditional &&
              session.status !== "CANCELLED",
          ).length;

          return {
            packageId: mentoringPackage.id,
            title: mentoringPackage.title,
            includedSessionCount: mentoringPackage.includedSessionCount,
            usedSessionCount,
            remainingSessionCount: Math.max(
              mentoringPackage.includedSessionCount - usedSessionCount,
              0,
            ),
          };
        });

        res.json({ sessions, packageUsage });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/sessions",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const mentorshipId = Number(req.params.id);
        if (!Number.isInteger(mentorshipId) || mentorshipId <= 0) {
          return res.status(400).json({ error: "Invalid mentorship id" });
        }

        const access = await getMentorshipAccess(req, mentorshipId);
        if (!access.allowed || !access.canManage || !access.mentorship) {
          return res.status(404).json({ error: "Mentorship not found" });
        }

        const input = scheduleMentoringSessionSchema.parse(req.body);

        if (input.packageId) {
          const mentoringPackage = await storage.getMentoringPackage(
            input.packageId,
          );
          if (
            !mentoringPackage ||
            mentoringPackage.mentorshipId !== mentorshipId
          ) {
            return res.status(400).json({
              error: "packageId must belong to this mentorship",
            });
          }
        }

        if (input.weekId) {
          const week = await storage.getWeek(input.weekId);
          if (
            !week ||
            week.roadmapId !== access.mentorship.roadmapId
          ) {
            return res.status(400).json({
              error: "weekId must belong to this mentorship roadmap",
            });
          }
        }

        const sessionData = insertMentoringSessionSchema.parse({
          mentorshipId,
          packageId: input.packageId ?? null,
          weekId: input.weekId ?? null,
          title: input.title,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          status: "SCHEDULED",
          isAdditional: input.isAdditional,
          additionalPriceMinor: input.additionalPriceMinor ?? null,
          additionalPriceCurrency: input.additionalPriceCurrency ?? null,
          learnerAttended: null,
          mentorNotes: null,
          calendarProvider: input.calendarProvider ?? null,
          calendarEventId: input.calendarEventId ?? null,
          createdByUserId: req.user!.id,
        });

        const session = await storage.createMentoringSession(sessionData);
        res.status(201).json(session);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/sessions/:id/complete",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const sessionId = Number(req.params.id);
        const session = Number.isInteger(sessionId)
          ? await storage.getMentoringSession(sessionId)
          : undefined;

        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const access = await getMentorshipAccess(req, session.mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Session not found" });
        }

        if (!canFinalizeMentoringSession(session.status)) {
          return res.status(409).json({
            error: `Session cannot be completed from status ${session.status}`,
          });
        }

        const input = completeMentoringSessionSchema.parse(req.body);
        const updated = await storage.updateMentoringSession(session.id, {
          status: finalStatusForAttendance(input.learnerAttended),
          learnerAttended: input.learnerAttended,
          mentorNotes: input.mentorNotes ?? null,
        });

        if (
          updated?.isAdditional &&
          updated.additionalPriceMinor !== null &&
          updated.additionalPriceCurrency
        ) {
          const sessionDate = updated.startsAt.toISOString().slice(0, 10);
          const billingPeriods = await storage.getBillingPeriodsByMentorship(
            updated.mentorshipId,
          );

          for (const billingPeriod of billingPeriods) {
            if (
              billingPeriod.status !== "VOID" &&
              sessionDate >= billingPeriod.periodStart &&
              sessionDate <= billingPeriod.periodEnd &&
              billingPeriod.currency.toUpperCase() ===
                updated.additionalPriceCurrency.toUpperCase()
            ) {
              await reconcileBillingPeriod(billingPeriod);
            }
          }
        }

        res.json(updated);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/sessions/:id/cancel",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const sessionId = Number(req.params.id);
        const session = Number.isInteger(sessionId)
          ? await storage.getMentoringSession(sessionId)
          : undefined;

        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const access = await getMentorshipAccess(req, session.mentorshipId);
        if (!access.allowed || !access.canManage) {
          return res.status(404).json({ error: "Session not found" });
        }

        if (!canFinalizeMentoringSession(session.status)) {
          return res.status(409).json({
            error: `Session cannot be cancelled from status ${session.status}`,
          });
        }

        const updated = await storage.updateMentoringSession(session.id, {
          status: "CANCELLED",
        });
        res.json(updated);
      } catch (error) {
        handleError(res, error);
      }
    },
  );
}
