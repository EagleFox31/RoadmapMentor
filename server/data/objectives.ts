import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  objectives,
  tasks,
  type Objective,
  type InsertObjective,
} from "@shared/schema";
import type { IStorage } from "./index";

export interface ObjectiveStore {
  getObjectivesByWeek(weekId: number): Promise<Objective[]>;
  getObjective(id: number): Promise<Objective | undefined>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: number, objective: Partial<InsertObjective>): Promise<Objective | undefined>;
  deleteObjective(id: number): Promise<boolean>;
  cloneObjective(id: number, targetWeekId?: number): Promise<Objective | undefined>;
}

export class ObjectiveRepository implements ObjectiveStore {
  constructor(private readonly store: () => IStorage) {}

  // Objective methods
  async getObjectivesByWeek(weekId: number): Promise<Objective[]> {
    return await db.select().from(objectives).where(eq(objectives.weekId, weekId)).orderBy(objectives.orderIndex);
  }

  async getObjective(id: number): Promise<Objective | undefined> {
    const [objective] = await db.select().from(objectives).where(eq(objectives.id, id));
    return objective || undefined;
  }

  async createObjective(objective: InsertObjective): Promise<Objective> {
    const [created] = await db.insert(objectives).values(objective).returning();
    return created;
  }

  async updateObjective(id: number, objective: Partial<InsertObjective>): Promise<Objective | undefined> {
    const [updated] = await db.update(objectives).set(objective).where(eq(objectives.id, id)).returning();
    return updated || undefined;
  }

  async deleteObjective(id: number): Promise<boolean> {
    const result = await db.delete(objectives).where(eq(objectives.id, id));
    return true;
  }

  async cloneObjective(id: number, targetWeekId?: number): Promise<Objective | undefined> {
    // Get the original objective
    const originalObjective = await this.getObjective(id);
    if (!originalObjective) return undefined;

    // Use the same week if targetWeekId is not provided
    const weekId = targetWeekId ?? originalObjective.weekId;

    // Get all objectives in the target week to determine the next orderIndex
    const existingObjectives = await this.getObjectivesByWeek(weekId);
    const maxOrderIndex = existingObjectives.length > 0 
      ? Math.max(...existingObjectives.map(o => o.orderIndex ?? 0))
      : 0;

    // Create new objective
    const [newObjective] = await db
      .insert(objectives)
      .values({
        weekId,
        type: originalObjective.type,
        title: `${originalObjective.title} (Copie)`,
        description: originalObjective.description,
        orderIndex: maxOrderIndex + 1,
      })
      .returning();

    // Clone all tasks for this objective
    const taskList = await this.store().getTasksByObjective(id);
    for (const task of taskList) {
      await db.insert(tasks).values({
        objectiveId: newObjective.id,
        label: task.label,
        orderIndex: task.orderIndex,
        isOptional: task.isOptional,
      });
    }

    return newObjective;
  }
}
