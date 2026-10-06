import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
  mentoringSessions,
  type MentoringSession,
  type InsertMentoringSession,
} from "@shared/schema";

export interface MentoringSessionStore {
  getMentoringSession(id: number): Promise<MentoringSession | undefined>;
  getMentoringSessionsByMentorship(mentorshipId: number): Promise<MentoringSession[]>;
  createMentoringSession(session: InsertMentoringSession): Promise<MentoringSession>;
  updateMentoringSession(id: number, patch: Partial<MentoringSession>): Promise<MentoringSession | undefined>;
}

export class MentoringSessionRepository implements MentoringSessionStore {
  // Mentoring session methods
  async getMentoringSession(id: number): Promise<MentoringSession | undefined> {
    const [session] = await db
      .select()
      .from(mentoringSessions)
      .where(eq(mentoringSessions.id, id))
      .limit(1);
    return session || undefined;
  }

  async getMentoringSessionsByMentorship(
    mentorshipId: number,
  ): Promise<MentoringSession[]> {
    return await db
      .select()
      .from(mentoringSessions)
      .where(eq(mentoringSessions.mentorshipId, mentorshipId))
      .orderBy(desc(mentoringSessions.startsAt), desc(mentoringSessions.id));
  }

  async createMentoringSession(
    session: InsertMentoringSession,
  ): Promise<MentoringSession> {
    const [created] = await db
      .insert(mentoringSessions)
      .values(session)
      .returning();
    return created;
  }

  async updateMentoringSession(
    id: number,
    patch: Partial<MentoringSession>,
  ): Promise<MentoringSession | undefined> {
    const { id: _id, createdAt: _createdAt, ...safePatch } = patch;
    const [updated] = await db
      .update(mentoringSessions)
      .set({ ...safePatch, updatedAt: new Date() })
      .where(eq(mentoringSessions.id, id))
      .returning();
    return updated || undefined;
  }
}
