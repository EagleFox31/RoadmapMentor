import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  tasks,
  type Task,
  type InsertTask,
} from "@shared/schema";

export interface TaskStore {
  getTasksByObjective(objectiveId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
}

export class TaskRepository implements TaskStore {
  // Task methods
  async getTasksByObjective(objectiveId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.objectiveId, objectiveId)).orderBy(tasks.orderIndex);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set(task).where(eq(tasks.id, id)).returning();
    return updated || undefined;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  }
}
