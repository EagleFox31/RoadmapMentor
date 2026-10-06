import { db } from "../db";
import { eq, inArray, isNull } from "drizzle-orm";
import {
  weeks,
  objectives,
  tasks,
  deliverables,
  resources,
  type Week,
  type InsertWeek,
  type RoadmapBulkInsert,
  type RoadmapBulkCreateResponse,
} from "@shared/schema";
import type { IStorage } from "./index";

export interface WeekStore {
  getAccessibleWeeks(userId: number, role: "MENTOR" | "LEARNER"): Promise<Week[]>;
  getWeeksByRoadmap(roadmapId: number): Promise<Week[]>;
  getAllWeeks(): Promise<Week[]>;
  getWeek(id: number): Promise<Week | undefined>;
  createWeek(week: InsertWeek): Promise<Week>;
  updateWeek(id: number, week: Partial<InsertWeek>): Promise<Week | undefined>;
  deleteWeek(id: number): Promise<boolean>;
  validateWeek(id: number): Promise<Week | undefined>;
  cloneWeek(id: number, newNumber: number): Promise<Week | undefined>;
  

  createRoadmapBulk(weeksData: RoadmapBulkInsert): Promise<RoadmapBulkCreateResponse>;
}

export class WeekRepository implements WeekStore {
  constructor(private readonly store: () => IStorage) {}

  // Week methods
  async getAccessibleWeeks(userId: number, role: "MENTOR" | "LEARNER"): Promise<Week[]> {
    const accessibleRoadmaps = await this.store().getRoadmapsForUser(userId, role);
    const roadmapIds = accessibleRoadmaps.map((roadmap) => roadmap.id);

    if (roadmapIds.length === 0) {
      return await db
        .select()
        .from(weeks)
        .where(isNull(weeks.roadmapId))
        .orderBy(weeks.number);
    }

    const assignedWeeks = await db
      .select()
      .from(weeks)
      .where(inArray(weeks.roadmapId, roadmapIds))
      .orderBy(weeks.number);

    const unassignedLegacyWeeks = await db
      .select()
      .from(weeks)
      .where(isNull(weeks.roadmapId))
      .orderBy(weeks.number);

    return [...unassignedLegacyWeeks, ...assignedWeeks];
  }

  async getWeeksByRoadmap(roadmapId: number): Promise<Week[]> {
    return await db
      .select()
      .from(weeks)
      .where(eq(weeks.roadmapId, roadmapId))
      .orderBy(weeks.number);
  }

  async getAllWeeks(): Promise<Week[]> {
    return await db.select().from(weeks).orderBy(weeks.number);
  }

  async getWeek(id: number): Promise<Week | undefined> {
    const [week] = await db.select().from(weeks).where(eq(weeks.id, id));
    return week || undefined;
  }

  async createWeek(week: InsertWeek): Promise<Week> {
    const [created] = await db.insert(weeks).values(week).returning();
    return created;
  }

  async updateWeek(id: number, week: Partial<InsertWeek>): Promise<Week | undefined> {
    const [updated] = await db.update(weeks).set(week).where(eq(weeks.id, id)).returning();
    return updated || undefined;
  }

  async deleteWeek(id: number): Promise<boolean> {
    const result = await db.delete(weeks).where(eq(weeks.id, id));
    return true;
  }

  async validateWeek(id: number): Promise<Week | undefined> {
    const [updated] = await db
      .update(weeks)
      .set({ isValidatedByMentor: true })
      .where(eq(weeks.id, id))
      .returning();
    return updated || undefined;
  }

  async cloneWeek(id: number, newNumber: number): Promise<Week | undefined> {
    // Get the original week
    const originalWeek = await this.getWeek(id);
    if (!originalWeek) return undefined;

    // Create new week
    const [newWeek] = await db
      .insert(weeks)
      .values({
        roadmapId: originalWeek.roadmapId,
        number: newNumber,
        title: `${originalWeek.title} (Copie)`,
        startDate: originalWeek.startDate,
        endDate: originalWeek.endDate,
        description: originalWeek.description,
        isValidatedByMentor: false,
      })
      .returning();

    // Clone objectives and their tasks
    const objectiveList = await this.store().getObjectivesByWeek(id);
    for (const objective of objectiveList) {
      const [newObjective] = await db
        .insert(objectives)
        .values({
          weekId: newWeek.id,
          type: objective.type,
          title: objective.title,
          description: objective.description,
          orderIndex: objective.orderIndex,
        })
        .returning();

      // Clone tasks for this objective
      const taskList = await this.store().getTasksByObjective(objective.id);
      for (const task of taskList) {
        await db.insert(tasks).values({
          objectiveId: newObjective.id,
          label: task.label,
          orderIndex: task.orderIndex,
          isOptional: task.isOptional,
        });
      }
    }

    // Clone deliverables
    const deliverablesList = await this.store().getDeliverablesByWeek(id);
    for (const deliverable of deliverablesList) {
      await db.insert(deliverables).values({
        weekId: newWeek.id,
        title: deliverable.title,
        description: deliverable.description,
      });
    }

    // Clone resources
    const resourcesList = await this.store().getResourcesByWeek(id);
    for (const resource of resourcesList) {
      await db.insert(resources).values({
        weekId: newWeek.id,
        label: resource.label,
        url: resource.url,
        resourceType: resource.resourceType,
      });
    }

    return newWeek;
  }


  // Bulk roadmap creation with transaction (OPTIMIZED with grouped inserts)
  async createRoadmapBulk(weeksData: RoadmapBulkInsert): Promise<RoadmapBulkCreateResponse> {
    return await db.transaction(async (tx) => {
      const result: RoadmapBulkCreateResponse = { weeks: [] };

      for (const weekData of weeksData) {
        // 1. Insert the week
        const [insertedWeek] = await tx
          .insert(weeks)
          .values({
            roadmapId: weekData.roadmapId ?? null,
            number: weekData.number,
            title: weekData.title,
            startDate: weekData.startDate,
            endDate: weekData.endDate,
            description: weekData.description || "",
            isValidatedByMentor: false,
          })
          .returning();

        // 2. Group insert all objectives for this week
        const objectivesToInsert = weekData.objectives.map((obj, index) => ({
          weekId: insertedWeek.id,
          type: obj.type,
          title: obj.title,
          description: obj.description || "",
          orderIndex: obj.orderIndex !== undefined ? obj.orderIndex : index,
        }));

        const insertedObjectives = await tx
          .insert(objectives)
          .values(objectivesToInsert)
          .returning();

        // 3. For each inserted objective, group insert its tasks
        const objectivesResult = [];
        for (let i = 0; i < insertedObjectives.length; i++) {
          const insertedObj = insertedObjectives[i];
          const originalObj = weekData.objectives[i]; // Same order as insertion

          const tasksToInsert = originalObj.tasks.map((task, taskIndex) => ({
            objectiveId: insertedObj.id,
            label: task.label,
            orderIndex: task.orderIndex !== undefined ? task.orderIndex : taskIndex,
            isOptional: task.isOptional || false,
          }));

          const insertedTasks = await tx
            .insert(tasks)
            .values(tasksToInsert)
            .returning();

          objectivesResult.push({
            id: insertedObj.id,
            tempId: originalObj.tempId,
            tasks: insertedTasks.map((t, idx) => ({ 
              id: t.id,
              tempId: originalObj.tasks[idx].tempId,
            })),
          });
        }

        // 4. Group insert deliverables (if any)
        const deliverablesResult = [];
        if (weekData.deliverables && weekData.deliverables.length > 0) {
          const deliverablesToInsert = weekData.deliverables.map((d) => ({
            weekId: insertedWeek.id,
            title: d.title,
            description: d.description || "",
            instructions: d.instructions || "",
          }));

          const insertedDeliverables = await tx
            .insert(deliverables)
            .values(deliverablesToInsert)
            .returning();

          deliverablesResult.push(...insertedDeliverables.map((d) => ({ id: d.id })));
        }

        // 5. Group insert resources (if any)
        const resourcesResult = [];
        if (weekData.resources && weekData.resources.length > 0) {
          const resourcesToInsert = weekData.resources.map((r) => ({
            weekId: insertedWeek.id,
            label: r.label,
            url: r.url,
            resourceType: r.resourceType,
          }));

          const insertedResources = await tx
            .insert(resources)
            .values(resourcesToInsert)
            .returning();

          resourcesResult.push(...insertedResources.map((r) => ({ id: r.id })));
        }

        // Add to result
        result.weeks.push({
          id: insertedWeek.id,
          number: insertedWeek.number,
          objectives: objectivesResult,
          deliverables: deliverablesResult,
          resources: resourcesResult,
        });
      }

      return result;
    });
  }
}
