import { storage } from "../storage";
import { type AuthRequest } from "../auth";
import { insertBillingChargeSchema, type BillingPeriod } from "@shared/schema";
import { assertCurrencyMatches, summarizeBilling } from "../domain/billing";
import { getMentorshipAccess } from "../access/mentorshipAccess";

export const getBillingPeriodAccess = async (
  req: AuthRequest,
  billingPeriodId: number,
) => {
  const billingPeriod = await storage.getBillingPeriod(billingPeriodId);
  if (!billingPeriod) {
    return { billingPeriod: undefined, allowed: false, canManage: false };
  }

  const mentorshipAccess = await getMentorshipAccess(
    req,
    billingPeriod.mentorshipId,
  );

  return {
    billingPeriod,
    allowed: mentorshipAccess.allowed,
    canManage: mentorshipAccess.canManage,
  };
};

export const buildBillingPeriodDetails = async (billingPeriod: BillingPeriod) => {
  const [charges, payments] = await Promise.all([
    storage.getBillingChargesByPeriod(billingPeriod.id),
    storage.getPaymentsByBillingPeriod(billingPeriod.id),
  ]);

  const summary = summarizeBilling({
    baseAmountMinor: billingPeriod.baseAmountMinor,
    charges,
    payments,
    isVoid: billingPeriod.status === "VOID",
  });

  return {
    ...billingPeriod,
    charges,
    payments,
    ...summary,
  };
};

export const refreshBillingPeriodStatus = async (billingPeriod: BillingPeriod) => {
  const details = await buildBillingPeriodDetails(billingPeriod);
  if (
    billingPeriod.status !== "VOID" &&
    details.status !== billingPeriod.status
  ) {
    const updated = await storage.updateBillingPeriod(billingPeriod.id, {
      status: details.status,
    });
    return updated ? await buildBillingPeriodDetails(updated) : details;
  }
  return details;
};

export const reconcileBillingPeriod = async (billingPeriod: BillingPeriod) => {
  if (billingPeriod.status === "VOID") {
    return await buildBillingPeriodDetails(billingPeriod);
  }

  const requests = await storage.getChangeRequestsByMentorship(
    billingPeriod.mentorshipId,
  );

  for (const request of requests) {
    if (
      request.packageId !== billingPeriod.packageId ||
      (request.status !== "ACCEPTED" && request.status !== "DELIVERED") ||
      request.quotedPriceMinor === null
    ) {
      continue;
    }

    assertCurrencyMatches(billingPeriod.currency, request.currency);
    const existing = await storage.findBillingChargeByChangeRequest(
      request.id,
    );
    if (!existing) {
      const charge = insertBillingChargeSchema.parse({
        billingPeriodId: billingPeriod.id,
        type: "CHANGE_REQUEST",
        description: "Scope additionnel · " + request.title,
        amountMinor: request.quotedPriceMinor,
        changeRequestId: request.id,
        sessionId: null,
      });
      await storage.createBillingCharge(charge);
    }
  }

  const sessions = await storage.getMentoringSessionsByMentorship(
    billingPeriod.mentorshipId,
  );

  for (const session of sessions) {
    const sessionDate = session.startsAt.toISOString().slice(0, 10);
    const billableStatus =
      session.status === "COMPLETED" || session.status === "NO_SHOW";

    if (
      !session.isAdditional ||
      !billableStatus ||
      sessionDate < billingPeriod.periodStart ||
      sessionDate > billingPeriod.periodEnd ||
      session.additionalPriceMinor === null ||
      !session.additionalPriceCurrency
    ) {
      continue;
    }

    assertCurrencyMatches(
      billingPeriod.currency,
      session.additionalPriceCurrency,
    );
    const existing = await storage.findBillingChargeBySession(session.id);
    if (!existing) {
      const charge = insertBillingChargeSchema.parse({
        billingPeriodId: billingPeriod.id,
        type: "ADDITIONAL_SESSION",
        description: "Séance additionnelle · " + session.title,
        amountMinor: session.additionalPriceMinor,
        changeRequestId: null,
        sessionId: session.id,
      });
      await storage.createBillingCharge(charge);
    }
  }

  return await refreshBillingPeriodStatus(billingPeriod);
};
