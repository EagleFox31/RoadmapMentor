// From javascript_database blueprint - using DatabaseStorage
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import {
  users,
  weeks,
  objectives,
  tasks,
  deliverables,
  resources,
  taskProgress,
  weekComments,
  emailNotificationPreferences,
  type User,
  type InsertUser,
  type Week,
  type InsertWeek,
  type Objective,
  type InsertObjective,
  type Task,
  type InsertTask,
  type Deliverable,
  type InsertDeliverable,
  type Resource,
  type InsertResource,
  type TaskProgress,
  type TaskProgressWithLearner,
  type InsertTaskProgress,
  type WeekComment,
  type InsertWeekComment,
  type EmailNotificationPreferences,
  type InsertEmailNotificationPreferences,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Week methods
  getAllWeeks(): Promise<Week[]>;
  getWeek(id: number): Promise<Week | undefined>;
  createWeek(week: InsertWeek): Promise<Week>;
  updateWeek(id: number, week: Partial<InsertWeek>): Promise<Week | undefined>;
  deleteWeek(id: number): Promise<boolean>;
  validateWeek(id: number): Promise<Week | undefined>;
  cloneWeek(id: number, newNumber: number): Promise<Week | undefined>;

  // Objective methods
  getObjectivesByWeek(weekId: number): Promise<Objective[]>;
  getObjective(id: number): Promise<Objective | undefined>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: number, objective: Partial<InsertObjective>): Promise<Objective | undefined>;
  deleteObjective(id: number): Promise<boolean>;
  cloneObjective(id: number, targetWeekId?: number): Promise<Objective | undefined>;

  // Task methods
  getTasksByObjective(objectiveId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;

  // Deliverable methods
  getDeliverablesByWeek(weekId: number): Promise<Deliverable[]>;
  getDeliverable(id: number): Promise<Deliverable | undefined>;
  createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: number, deliverable: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(id: number): Promise<boolean>;

  // Resource methods
  getResourcesByWeek(weekId: number): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;

  // Task Progress methods
  getTaskProgress(taskId: number, learnerId: number): Promise<TaskProgress | undefined>;
  getAllTaskProgress(taskId: number): Promise<TaskProgressWithLearner[]>;
  getProgressByLearner(learnerId: number): Promise<TaskProgress[]>;
  toggleTaskProgress(taskId: number, learnerId: number, screenshotUrl?: string): Promise<TaskProgress>;

  // Week Comment methods
  getCommentsByWeek(weekId: number): Promise<WeekComment[]>;
  createComment(comment: InsertWeekComment): Promise<WeekComment>;

  // Email Notification Preferences methods
  getEmailPreferences(userId: number): Promise<EmailNotificationPreferences | undefined>;
  updateEmailPreferences(userId: number, preferences: Partial<InsertEmailNotificationPreferences>): Promise<EmailNotificationPreferences>;
  createEmailPreferences(preferences: InsertEmailNotificationPreferences): Promise<EmailNotificationPreferences>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Week methods
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
        number: newNumber,
        title: `${originalWeek.title} (Copie)`,
        startDate: originalWeek.startDate,
        endDate: originalWeek.endDate,
        description: originalWeek.description,
        isValidatedByMentor: false,
      })
      .returning();

    // Clone objectives and their tasks
    const objectives = await this.getObjectivesByWeek(id);
    for (const objective of objectives) {
      const [newObjective] = await db
        .insert(objectives as any)
        .values({
          weekId: newWeek.id,
          type: objective.type,
          title: objective.title,
          description: objective.description,
          orderIndex: objective.orderIndex,
        })
        .returning();

      // Clone tasks for this objective
      const taskList = await this.getTasksByObjective(objective.id);
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
    const deliverablesList = await this.getDeliverablesByWeek(id);
    for (const deliverable of deliverablesList) {
      await db.insert(deliverables).values({
        weekId: newWeek.id,
        title: deliverable.title,
        description: deliverable.description,
      });
    }

    // Clone resources
    const resourcesList = await this.getResourcesByWeek(id);
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
    const taskList = await this.getTasksByObjective(id);
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

  // Deliverable methods
  async getDeliverablesByWeek(weekId: number): Promise<Deliverable[]> {
    return await db.select().from(deliverables).where(eq(deliverables.weekId, weekId));
  }

  async getDeliverable(id: number): Promise<Deliverable | undefined> {
    const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, id));
    return deliverable || undefined;
  }

  async createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable> {
    const [created] = await db.insert(deliverables).values(deliverable).returning();
    return created;
  }

  async updateDeliverable(id: number, deliverable: Partial<InsertDeliverable>): Promise<Deliverable | undefined> {
    const [updated] = await db.update(deliverables).set(deliverable).where(eq(deliverables.id, id)).returning();
    return updated || undefined;
  }

  async deleteDeliverable(id: number): Promise<boolean> {
    const result = await db.delete(deliverables).where(eq(deliverables.id, id));
    return true;
  }

  // Resource methods
  async getResourcesByWeek(weekId: number): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.weekId, weekId));
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    return created;
  }

  async updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined> {
    const [updated] = await db.update(resources).set(resource).where(eq(resources.id, id)).returning();
    return updated || undefined;
  }

  async deleteResource(id: number): Promise<boolean> {
    const result = await db.delete(resources).where(eq(resources.id, id));
    return true;
  }

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
    const existing = await this.getTaskProgress(taskId, learnerId);

    if (existing) {
      // Toggle the existing progress
      const [updated] = await db
        .update(taskProgress)
        .set({
          isDone: !existing.isDone,
          doneAt: !existing.isDone ? new Date() : null,
          screenshotUrl: screenshotUrl || existing.screenshotUrl,
        })
        .where(eq(taskProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress entry
      const [created] = await db
        .insert(taskProgress)
        .values({
          taskId,
          learnerId,
          isDone: true,
          doneAt: new Date(),
          screenshotUrl,
        })
        .returning();
      return created;
    }
  }

  // Week Comment methods
  async getCommentsByWeek(weekId: number): Promise<WeekComment[]> {
    return await db.select().from(weekComments).where(eq(weekComments.weekId, weekId)).orderBy(desc(weekComments.createdAt));
  }

  async createComment(comment: InsertWeekComment): Promise<WeekComment> {
    const [created] = await db.insert(weekComments).values(comment).returning();
    return created;
  }

  // Email Notification Preferences methods
  async getEmailPreferences(userId: number): Promise<EmailNotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(emailNotificationPreferences)
      .where(eq(emailNotificationPreferences.userId, userId));
    return prefs || undefined;
  }

  async updateEmailPreferences(userId: number, preferences: Partial<InsertEmailNotificationPreferences>): Promise<EmailNotificationPreferences> {
    const [updated] = await db
      .update(emailNotificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(emailNotificationPreferences.userId, userId))
      .returning();
    
    if (!updated) {
      // Si les préférences n'existent pas, les créer
      return await this.createEmailPreferences({ userId, ...preferences } as InsertEmailNotificationPreferences);
    }
    
    return updated;
  }

  async createEmailPreferences(preferences: InsertEmailNotificationPreferences): Promise<EmailNotificationPreferences> {
    const [created] = await db
      .insert(emailNotificationPreferences)
      .values(preferences)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
