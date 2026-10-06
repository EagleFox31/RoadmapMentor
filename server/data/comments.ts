import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
  weekComments,
  type Week,
  type WeekComment,
  type InsertWeekComment,
} from "@shared/schema";

export interface CommentStore {
  getCommentsByWeek(weekId: number): Promise<WeekComment[]>;
  createComment(comment: InsertWeekComment): Promise<WeekComment>;
}

export class CommentRepository implements CommentStore {
  // Week Comment methods
  async getCommentsByWeek(weekId: number): Promise<WeekComment[]> {
    return await db.select().from(weekComments).where(eq(weekComments.weekId, weekId)).orderBy(desc(weekComments.createdAt));
  }

  async createComment(comment: InsertWeekComment): Promise<WeekComment> {
    const [created] = await db.insert(weekComments).values(comment).returning();
    return created;
  }
}
