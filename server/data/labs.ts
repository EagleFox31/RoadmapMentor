import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  labs,
  labSubmissions,
  type Lab,
  type InsertLab,
  type LabSubmission,
} from "@shared/schema";

export interface LabStore {
  getLabsByWeek(weekId: number): Promise<Lab[]>;
  getLab(id: number): Promise<Lab | undefined>;
  createLab(lab: InsertLab): Promise<Lab>;
  updateLab(id: number, lab: Partial<InsertLab>): Promise<Lab | undefined>;
  deleteLab(id: number): Promise<boolean>;
  getLabSubmission(id: number): Promise<LabSubmission | undefined>;
  getLabSubmissionForLearner(labId: number, learnerId: number): Promise<LabSubmission | undefined>;
  getLabSubmissions(labId: number): Promise<LabSubmission[]>;
  saveLabSubmission(
    labId: number,
    learnerId: number,
    code: string,
    output: string | null,
    submit: boolean,
  ): Promise<LabSubmission>;
  reviewLabSubmission(
    id: number,
    status: "APPROVED" | "CHANGES_REQUESTED",
    feedback: string | null,
  ): Promise<LabSubmission | undefined>;
}

export class LabRepository implements LabStore {
  // Lab methods
  async getLabsByWeek(weekId: number): Promise<Lab[]> {
    return await db
      .select()
      .from(labs)
      .where(eq(labs.weekId, weekId))
      .orderBy(labs.orderIndex, labs.id);
  }

  async getLab(id: number): Promise<Lab | undefined> {
    const [lab] = await db.select().from(labs).where(eq(labs.id, id));
    return lab || undefined;
  }

  async createLab(lab: InsertLab): Promise<Lab> {
    const [created] = await db.insert(labs).values(lab).returning();
    return created;
  }

  async updateLab(id: number, lab: Partial<InsertLab>): Promise<Lab | undefined> {
    const [updated] = await db
      .update(labs)
      .set({ ...lab, updatedAt: new Date() })
      .where(eq(labs.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLab(id: number): Promise<boolean> {
    await db.delete(labs).where(eq(labs.id, id));
    return true;
  }

  async getLabSubmission(id: number): Promise<LabSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(labSubmissions)
      .where(eq(labSubmissions.id, id));
    return submission || undefined;
  }

  async getLabSubmissionForLearner(labId: number, learnerId: number): Promise<LabSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(labSubmissions)
      .where(and(eq(labSubmissions.labId, labId), eq(labSubmissions.learnerId, learnerId)));
    return submission || undefined;
  }

  async getLabSubmissions(labId: number): Promise<LabSubmission[]> {
    return await db
      .select()
      .from(labSubmissions)
      .where(eq(labSubmissions.labId, labId))
      .orderBy(desc(labSubmissions.updatedAt));
  }

  async saveLabSubmission(
    labId: number,
    learnerId: number,
    code: string,
    output: string | null,
    submit: boolean,
  ): Promise<LabSubmission> {
    const now = new Date();
    const [submission] = await db
      .insert(labSubmissions)
      .values({
        labId,
        learnerId,
        code,
        output,
        status: submit ? "SUBMITTED" : "IN_PROGRESS",
        submittedAt: submit ? now : null,
        reviewedAt: null,
        mentorFeedback: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [labSubmissions.labId, labSubmissions.learnerId],
        set: {
          code,
          output,
          status: submit ? "SUBMITTED" : "IN_PROGRESS",
          submittedAt: submit ? now : null,
          reviewedAt: null,
          mentorFeedback: null,
          updatedAt: now,
        },
      })
      .returning();
    return submission;
  }

  async reviewLabSubmission(
    id: number,
    status: "APPROVED" | "CHANGES_REQUESTED",
    feedback: string | null,
  ): Promise<LabSubmission | undefined> {
    const [updated] = await db
      .update(labSubmissions)
      .set({ status, mentorFeedback: feedback, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(labSubmissions.id, id))
      .returning();
    return updated || undefined;
  }
}
