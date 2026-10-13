import { db } from "../db";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { emailOtps, type EmailOtp, type InsertEmailOtp } from "@shared/schema";

export interface EmailOtpStore {
  createEmailOtp(data: {
    email: string;
    codeHash: string;
    purpose: "REGISTRATION" | "LOGIN";
    payload?: string;
    expiresAt: Date;
  }): Promise<EmailOtp>;
  getLatestActiveEmailOtp(
    email: string,
    purpose: "REGISTRATION" | "LOGIN",
  ): Promise<EmailOtp | undefined>;
  getLatestOtp(email: string): Promise<EmailOtp | undefined>;
  countRecentOtps(email: string, since: Date): Promise<number>;
  incrementOtpAttempts(id: number): Promise<number>;
  markOtpConsumed(id: number): Promise<void>;
}

export class EmailOtpRepository implements EmailOtpStore {
  async createEmailOtp(data: {
    email: string;
    codeHash: string;
    purpose: "REGISTRATION" | "LOGIN";
    payload?: string;
    expiresAt: Date;
  }): Promise<EmailOtp> {
    const [row] = await db
      .insert(emailOtps)
      .values({
        email: data.email.toLowerCase().trim(),
        codeHash: data.codeHash,
        purpose: data.purpose,
        payload: data.payload,
        expiresAt: data.expiresAt,
      })
      .returning();
    return row;
  }

  async getLatestActiveEmailOtp(
    email: string,
    purpose: "REGISTRATION" | "LOGIN",
  ): Promise<EmailOtp | undefined> {
    const now = new Date();
    const [row] = await db
      .select()
      .from(emailOtps)
      .where(
        and(
          eq(emailOtps.email, email.toLowerCase().trim()),
          eq(emailOtps.purpose, purpose),
          isNull(emailOtps.consumedAt),
          gte(emailOtps.expiresAt, now),
        ),
      )
      .orderBy(desc(emailOtps.createdAt))
      .limit(1);
    return row;
  }

  async getLatestOtp(email: string): Promise<EmailOtp | undefined> {
    const [row] = await db
      .select()
      .from(emailOtps)
      .where(eq(emailOtps.email, email.toLowerCase().trim()))
      .orderBy(desc(emailOtps.createdAt))
      .limit(1);
    return row;
  }

  async countRecentOtps(email: string, since: Date): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailOtps)
      .where(
        and(
          eq(emailOtps.email, email.toLowerCase().trim()),
          gte(emailOtps.createdAt, since),
        ),
      );
    return result?.count ?? 0;
  }

  async incrementOtpAttempts(id: number): Promise<number> {
    const [updated] = await db
      .update(emailOtps)
      .set({ attempts: sql`${emailOtps.attempts} + 1` })
      .where(eq(emailOtps.id, id))
      .returning({ attempts: emailOtps.attempts });
    return updated?.attempts ?? 0;
  }

  async markOtpConsumed(id: number): Promise<void> {
    await db
      .update(emailOtps)
      .set({ consumedAt: new Date() })
      .where(eq(emailOtps.id, id));
  }
}
