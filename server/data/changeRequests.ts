import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
  changeRequests,
  type ChangeRequest,
  type InsertChangeRequest,
} from "@shared/schema";

export interface ChangeRequestStore {
  getChangeRequest(id: number): Promise<ChangeRequest | undefined>;
  getChangeRequestsByMentorship(mentorshipId: number): Promise<ChangeRequest[]>;
  createChangeRequest(changeRequest: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: number, patch: Partial<ChangeRequest>): Promise<ChangeRequest | undefined>;
}

export class ChangeRequestRepository implements ChangeRequestStore {
  // Change request methods
  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    const [changeRequest] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);
    return changeRequest || undefined;
  }

  async getChangeRequestsByMentorship(
    mentorshipId: number,
  ): Promise<ChangeRequest[]> {
    return await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.mentorshipId, mentorshipId))
      .orderBy(desc(changeRequests.createdAt));
  }

  async createChangeRequest(
    changeRequest: InsertChangeRequest,
  ): Promise<ChangeRequest> {
    const [created] = await db
      .insert(changeRequests)
      .values(changeRequest)
      .returning();
    return created;
  }

  async updateChangeRequest(
    id: number,
    patch: Partial<ChangeRequest>,
  ): Promise<ChangeRequest | undefined> {
    const { id: _id, createdAt: _createdAt, ...safePatch } = patch;
    const [updated] = await db
      .update(changeRequests)
      .set({ ...safePatch, updatedAt: new Date() })
      .where(eq(changeRequests.id, id))
      .returning();
    return updated || undefined;
  }
}
