import { type Express } from "express";
import { storage } from "../storage";
import { authMiddleware, requireMentor, type AuthRequest } from "../auth";
import { createBillingPeriodSchema, insertBillingPeriodSchema, insertBillingChargeSchema, manualBillingChargeSchema, insertPaymentSchema, recordManualPaymentSchema } from "@shared/schema";
import { manualPaymentAdapter } from "../payments/provider";
import { handleError } from "../http/errors";
import { getMentorshipAccess } from "../access/mentorshipAccess";
import { getBillingPeriodAccess, buildBillingPeriodDetails, refreshBillingPeriodStatus, reconcileBillingPeriod } from "../services/billingPeriods";

export function registerBillingRoutes(app: Express) {
  app.get(
    "/api/mentorships/:id/billing",
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

        const periods = await storage.getBillingPeriodsByMentorship(
          mentorshipId,
        );
        const details = await Promise.all(
          periods.map((period) => buildBillingPeriodDetails(period)),
        );

        res.json(details);
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/mentorships/:id/billing-periods",
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

        const input = createBillingPeriodSchema.parse(req.body);
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

        const existing = await storage.findBillingPeriodByPackage(
          mentoringPackage.id,
        );
        if (existing) {
          return res.status(200).json(
            await reconcileBillingPeriod(existing),
          );
        }

        const billingPeriodData = insertBillingPeriodSchema.parse({
          mentorshipId,
          packageId: mentoringPackage.id,
          title: mentoringPackage.title,
          currency: mentoringPackage.currency,
          periodStart: mentoringPackage.periodStart,
          periodEnd: mentoringPackage.periodEnd,
          dueDate: input.dueDate,
          baseAmountMinor: mentoringPackage.basePriceMinor,
          status: "DUE",
          createdByUserId: req.user!.id,
        });

        const billingPeriod = await storage.createBillingPeriod(
          billingPeriodData,
        );
        res.status(201).json(
          await reconcileBillingPeriod(billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/reconcile",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        res.json(await reconcileBillingPeriod(access.billingPeriod));
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/charges",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        if (access.billingPeriod.status === "VOID") {
          return res.status(409).json({ error: "Billing period is void" });
        }

        const input = manualBillingChargeSchema.parse(req.body);
        const charge = insertBillingChargeSchema.parse({
          billingPeriodId: access.billingPeriod.id,
          type: "MANUAL",
          description: input.description,
          amountMinor: input.amountMinor,
          changeRequestId: null,
          sessionId: null,
        });

        await storage.createBillingCharge(charge);
        res.status(201).json(
          await refreshBillingPeriodStatus(access.billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/billing-periods/:id/payments",
    authMiddleware,
    requireMentor,
    async (req: AuthRequest, res) => {
      try {
        const billingPeriodId = Number(req.params.id);
        const access = Number.isInteger(billingPeriodId)
          ? await getBillingPeriodAccess(req, billingPeriodId)
          : { billingPeriod: undefined, allowed: false, canManage: false };

        if (
          !access.billingPeriod ||
          !access.allowed ||
          !access.canManage
        ) {
          return res.status(404).json({ error: "Billing period not found" });
        }

        if (access.billingPeriod.status === "VOID") {
          return res.status(409).json({ error: "Billing period is void" });
        }

        const input = recordManualPaymentSchema.parse(req.body);
        const current = await buildBillingPeriodDetails(
          access.billingPeriod,
        );
        if (input.amountMinor > current.outstandingMinor) {
          return res.status(409).json({
            error: "Payment exceeds the outstanding amount",
          });
        }

        const capture = await manualPaymentAdapter.capture({
          amountMinor: input.amountMinor,
          currency: access.billingPeriod.currency,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          method: input.method ?? null,
          providerReference: input.providerReference ?? null,
          note: input.note ?? null,
        });

        const payment = insertPaymentSchema.parse({
          billingPeriodId: access.billingPeriod.id,
          amountMinor: capture.amountMinor,
          currency: capture.currency,
          provider: manualPaymentAdapter.name,
          providerReference: capture.providerReference,
          method: capture.method,
          note: capture.note,
          paidAt: capture.paidAt,
          recordedByUserId: req.user!.id,
        });

        await storage.createPayment(payment);
        res.status(201).json(
          await refreshBillingPeriodStatus(access.billingPeriod),
        );
      } catch (error) {
        handleError(res, error);
      }
    },
  );
}
