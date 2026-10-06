import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  users,
  taskProgress,
  type Task,
  type TaskProgress,
  type TaskProgressWithLearner,
} from "@shared/schema";

export interface ProgressStore {
  getTaskProgress(taskId: number, learnerId: number): Promise<TaskProgress | undefined>;
  getAllTaskProgress(taskId: number): Promise<TaskProgressWithLearner[]>;
  getProgressByLearner(learnerId: number): Promise<TaskProgress[]>;
  toggleTaskProgress(taskId: number, learnerId: number, screenshotUrl?: string): Promise<TaskProgress>;
}

export class ProgressRepository implements ProgressStore {
  // Task Progress methods
  async getTaskProgress(taskId: number, learnerId: number): Promise<TaskProgress | undefined> {
    const [progress] = await db
      .select()
      .from(taskProgress)
      .where(and(eq(taskProgress.taskId, taskId), eq(taskProgress.learnerId, learnerId)));
    return progress || undefined;
  }

  async getAllTaskProgress(taskId: number): Promise<TaskProgressWithLearner[]> {
    const results = await db
      .select({
        id: taskProgress.id,
        taskId: taskProgress.taskId,
        learnerId: taskProgress.learnerId,
        isDone: taskProgress.isDone,
        screenshotUrl: taskProgress.screenshotUrl,
        doneAt: taskProgress.doneAt,
        createdAt: taskProgress.createdAt,
        learner: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(taskProgress)
      .innerJoin(users, eq(taskProgress.learnerId, users.id))
      .where(eq(taskProgress.taskId, taskId));

    return results;
  }

  async getProgressByLearner(learnerId: number): Promise<TaskProgress[]> {
    return await db.select().from(taskProgress).where(eq(taskProgress.learnerId, learnerId));
  }

  async toggleTaskProgress(taskId: number, learnerId: number, screenshotUrl?: string): Promise<TaskProgress> {
    // Single atomic upsert on the (task_id, learner_id) unique index: concurrent calls
    // can neither create duplicates nor lose a toggle.
    const [row] = await db
      .insert(taskProgress)
      .values({
        taskId,
        learnerId,
        isDone: true,
        doneAt: new Date(),
        screenshotUrl,
      })
      .onConflictDoUpdate({
        target: [taskProgress.taskId, taskProgress.learnerId],
        set: {
          isDone: sql`NOT ${taskProgress.isDone}`,
          doneAt: sql`CASE WHEN ${taskProgress.isDone} THEN NULL ELSE now() END`,
          screenshotUrl: sql`COALESCE(${screenshotUrl ?? null}, ${taskProgress.screenshotUrl})`,
        },
      })
      .returning();
    return row;
  }
}
