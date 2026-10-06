import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
  billingPeriods,
  billingCharges,
  payments,
  type BillingPeriod,
  type InsertBillingPeriod,
  type BillingCharge,
  type InsertBillingCharge,
  type Payment,
  type InsertPayment,
} from "@shared/schema";

export interface BillingStore {
  getBillingPeriod(id: number): Promise<BillingPeriod | undefined>;
  findBillingPeriodByPackage(packageId: number): Promise<BillingPeriod | undefined>;
  getBillingPeriodsByMentorship(mentorshipId: number): Promise<BillingPeriod[]>;
  createBillingPeriod(period: InsertBillingPeriod): Promise<BillingPeriod>;
  updateBillingPeriod(id: number, patch: Partial<BillingPeriod>): Promise<BillingPeriod | undefined>;
  getBillingChargesByPeriod(billingPeriodId: number): Promise<BillingCharge[]>;
  findBillingChargeByChangeRequest(changeRequestId: number): Promise<BillingCharge | undefined>;
  findBillingChargeBySession(sessionId: number): Promise<BillingCharge | undefined>;
  createBillingCharge(charge: InsertBillingCharge): Promise<BillingCharge>;
  getPaymentsByBillingPeriod(billingPeriodId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
}

export class BillingRepository implements BillingStore {
  // Billing methods
  async getBillingPeriod(id: number): Promise<BillingPeriod | undefined> {
    const [period] = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.id, id))
      .limit(1);
    return period || undefined;
  }

  async findBillingPeriodByPackage(
    packageId: number,
  ): Promise<BillingPeriod | undefined> {
    const [period] = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.packageId, packageId))
      .limit(1);
    return period || undefined;
  }

  async getBillingPeriodsByMentorship(
    mentorshipId: number,
  ): Promise<BillingPeriod[]> {
    return await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.mentorshipId, mentorshipId))
      .orderBy(desc(billingPeriods.periodStart), desc(billingPeriods.id));
  }

  async createBillingPeriod(
    period: InsertBillingPeriod,
  ): Promise<BillingPeriod> {
    const [created] = await db
      .insert(billingPeriods)
      .values(period)
      .returning();
    return created;
  }

  async updateBillingPeriod(
    id: number,
    patch: Partial<BillingPeriod>,
  ): Promise<BillingPeriod | undefined> {
    const { id: _id, createdAt: _createdAt, ...safePatch } = patch;
    const [updated] = await db
      .update(billingPeriods)
      .set({ ...safePatch, updatedAt: new Date() })
      .where(eq(billingPeriods.id, id))
      .returning();
    return updated || undefined;
  }

  async getBillingChargesByPeriod(
    billingPeriodId: number,
  ): Promise<BillingCharge[]> {
    return await db
      .select()
      .from(billingCharges)
      .where(eq(billingCharges.billingPeriodId, billingPeriodId))
      .orderBy(billingCharges.id);
  }

  async findBillingChargeByChangeRequest(
    changeRequestId: number,
  ): Promise<BillingCharge | undefined> {
    const [charge] = await db
      .select()
      .from(billingCharges)
      .where(eq(billingCharges.changeRequestId, changeRequestId))
      .limit(1);
    return charge || undefined;
  }

  async findBillingChargeBySession(
    sessionId: number,
  ): Promise<BillingCharge | undefined> {
    const [charge] = await db
      .select()
      .from(billingCharges)
      .where(eq(billingCharges.sessionId, sessionId))
      .limit(1);
    return charge || undefined;
  }

  async createBillingCharge(
    charge: InsertBillingCharge,
  ): Promise<BillingCharge> {
    const [created] = await db
      .insert(billingCharges)
      .values(charge)
      .returning();
    return created;
  }

  async getPaymentsByBillingPeriod(
    billingPeriodId: number,
  ): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.billingPeriodId, billingPeriodId))
      .orderBy(desc(payments.paidAt), desc(payments.id));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db
      .insert(payments)
      .values(payment)
      .returning();
    return created;
  }
}
