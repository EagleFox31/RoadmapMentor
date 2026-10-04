// From javascript_database blueprint - using DatabaseStorage
import { db } from "./db";
import { hasRoadmapAccess } from "./domain/roadmapAccess";
import { eq, and, desc, inArray, isNull, ne } from "drizzle-orm";
import {
  users,
  roadmaps,
  mentorships,
  mentoringPackages,
  mentoringPackageScopeItems,
  scopeChangeRequests,
  scopeChangeEvents,
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
  type Roadmap,
  type InsertRoadmap,
  type Mentorship,
  type InsertMentorship,
  type MentoringPackage,
  type MentoringPackageWithScope,
  type MentoringPackageCreate,
  type MentoringPackageScopeItem,
  type ScopeChangeRequest,
  type InsertScopeChangeRequest,
  type ScopeChangeEvent,
  type InsertScopeChangeEvent,
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
  type RoadmapBulkInsert,
  type RoadmapBulkCreateResponse,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByRole(role: "MENTOR" | "LEARNER"): Promise<User[]>;

  // Roadmap / mentorship methods
  getRoadmap(id: number): Promise<Roadmap | undefined>;
  getRoadmapsForUser(userId: number, role: "MENTOR" | "LEARNER"): Promise<Roadmap[]>;
  createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap>;
  createMentorship(mentorship: InsertMentorship): Promise<Mentorship>;
  getMentorship(id: number): Promise<Mentorship | undefined>;
  findMentorship(roadmapId: number, mentorId: number, learnerId: number): Promise<Mentorship | undefined>;
  getMentorshipsByRoadmap(roadmapId: number): Promise<Mentorship[]>;
  getMentorshipsForUser(userId: number, role: "MENTOR" | "LEARNER"): Promise<Mentorship[]>;
  userCanAccessRoadmap(userId: number, role: "MENTOR" | "LEARNER", roadmapId: number): Promise<boolean>;

  // Package / scope methods
  createMentoringPackage(
    mentorshipId: number,
    createdByUserId: number,
    data: MentoringPackageCreate,
  ): Promise<MentoringPackageWithScope>;
  getMentoringPackage(id: number): Promise<MentoringPackage | undefined>;
  getMentoringPackagesByMentorship(mentorshipId: number): Promise<MentoringPackageWithScope[]>;
  getPackageScopeItems(packageId: number): Promise<MentoringPackageScopeItem[]>;
  createScopeChangeRequest(
    data: InsertScopeChangeRequest,
    event: Omit<InsertScopeChangeEvent, "changeRequestId">,
  ): Promise<ScopeChangeRequest>;
  getScopeChangeRequest(id: number): Promise<ScopeChangeRequest | undefined>;
  getScopeChangeRequestsByMentorship(mentorshipId: number): Promise<ScopeChangeRequest[]>;
  transitionScopeChangeRequest(
    id: number,
    changes: Partial<ScopeChangeRequest>,
    event: Omit<InsertScopeChangeEvent, "changeRequestId">,
  ): Promise<ScopeChangeRequest | undefined>;
  getScopeChangeEvents(changeRequestId: number): Promise<ScopeChangeEvent[]>;

  // Week methods
  getAccessibleWeeks(userId: number, role: "MENTOR" | "LEARNER"): Promise<Week[]>;
  getWeeksByRoadmap(roadmapId: number): Promise<Week[]>;
  getAllWeeks(): Promise<Week[]>;
  getWeek(id: number): Promise<Week | undefined>;
  createWeek(week: InsertWeek): Promise<Week>;
  updateWeek(id: number, week: Partial<InsertWeek>): Promise<Week | undefined>;
  deleteWeek(id: number): Promise<boolean>;
  validateWeek(id: number): Promise<Week | undefined>;
  cloneWeek(id: number, newNumber: number): Promise<Week | undefined>;
  
  // Bulk roadmap creation (transactional)
  createRoadmapBulk(weeksData: RoadmapBulkInsert): Promise<RoadmapBulkCreateResponse>;

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

  async getUsersByRole(role: "MENTOR" | "LEARNER"): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(users.id);
  }

  // Roadmap / mentorship methods
  async getRoadmap(id: number): Promise<Roadmap | undefined> {
    const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    return roadmap || undefined;
  }

  async getRoadmapsForUser(userId: number, role: "MENTOR" | "LEARNER"): Promise<Roadmap[]> {
    const collected = new Map<number, Roadmap>();

    if (role === "MENTOR") {
      const owned = await db
        .select()
        .from(roadmaps)
        .where(eq(roadmaps.createdByUserId, userId));
      owned.forEach((roadmap) => collected.set(roadmap.id, roadmap));

      const legacy = await db
        .select()
        .from(roadmaps)
        .where(eq(roadmaps.isLegacy, true));
      legacy.forEach((roadmap) => collected.set(roadmap.id, roadmap));
    }

    const membershipRows = await db
      .select({ roadmap: roadmaps })
      .from(mentorships)
      .innerJoin(roadmaps, eq(mentorships.roadmapId, roadmaps.id))
      .where(
        and(
          role === "MENTOR"
            ? eq(mentorships.mentorId, userId)
            : eq(mentorships.learnerId, userId),
          ne(mentorships.status, "CANCELLED"),
        ),
      );

    membershipRows.forEach(({ roadmap }) => collected.set(roadmap.id, roadmap));
    return Array.from(collected.values()).sort((a, b) => a.id - b.id);
  }

  async createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap> {
    const [created] = await db.insert(roadmaps).values(roadmap).returning();
    return created;
  }

  async createMentorship(mentorship: InsertMentorship): Promise<Mentorship> {
    const [created] = await db.insert(mentorships).values(mentorship).returning();
    return created;
  }

  async getMentorship(id: number): Promise<Mentorship | undefined> {
    const [mentorship] = await db
      .select()
      .from(mentorships)
      .where(eq(mentorships.id, id));
    return mentorship || undefined;
  }

  async findMentorship(
    roadmapId: number,
    mentorId: number,
    learnerId: number,
  ): Promise<Mentorship | undefined> {
    const [mentorship] = await db
      .select()
      .from(mentorships)
      .where(
        and(
          eq(mentorships.roadmapId, roadmapId),
          eq(mentorships.mentorId, mentorId),
          eq(mentorships.learnerId, learnerId),
        ),
      )
      .limit(1);
    return mentorship || undefined;
  }

  async getMentorshipsByRoadmap(roadmapId: number): Promise<Mentorship[]> {
    return await db
      .select()
      .from(mentorships)
      .where(eq(mentorships.roadmapId, roadmapId))
      .orderBy(mentorships.id);
  }

  async getMentorshipsForUser(
    userId: number,
    role: "MENTOR" | "LEARNER",
  ): Promise<Mentorship[]> {
    return await db
      .select()
      .from(mentorships)
      .where(
        and(
          role === "MENTOR"
            ? eq(mentorships.mentorId, userId)
            : eq(mentorships.learnerId, userId),
          ne(mentorships.status, "CANCELLED"),
        ),
      )
      .orderBy(mentorships.id);
  }

  async userCanAccessRoadmap(
    userId: number,
    role: "MENTOR" | "LEARNER",
    roadmapId: number,
  ): Promise<boolean> {
    const roadmap = await this.getRoadmap(roadmapId);
    if (!roadmap) {
      return false;
    }

    const roadmapMemberships = await this.getMentorshipsByRoadmap(roadmapId);
    return hasRoadmapAccess({
      userId,
      role,
      roadmap,
      memberships: roadmapMemberships,
    });
  }

  // Package / scope methods
  async createMentoringPackage(
    mentorshipId: number,
    createdByUserId: number,
    data: MentoringPackageCreate,
  ): Promise<MentoringPackageWithScope> {
    return await db.transaction(async (tx) => {
      const [createdPackage] = await tx
        .insert(mentoringPackages)
        .values({
          mentorshipId,
          label: data.label,
          priceAmount: data.priceAmount,
          currency: data.currency.toUpperCase(),
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          includedSessionCount: data.includedSessionCount,
          sessionDurationMinutes: data.sessionDurationMinutes ?? null,
          sessionRules: data.sessionRules ?? null,
          scopeSummary: data.scopeSummary ?? null,
          createdByUserId,
        })
        .returning();

      const scopeItems =
        data.scopeItems.length === 0
          ? []
          : await tx
              .insert(mentoringPackageScopeItems)
              .values(
                data.scopeItems.map((item) => ({
                  packageId: createdPackage.id,
                  kind: item.kind,
                  title: item.title,
                  description: item.description ?? null,
                })),
              )
              .returning();

      return { ...createdPackage, scopeItems };
    });
  }

  async getMentoringPackage(id: number): Promise<MentoringPackage | undefined> {
    const [mentoringPackage] = await db
      .select()
      .from(mentoringPackages)
      .where(eq(mentoringPackages.id, id));
    return mentoringPackage || undefined;
  }

  async getPackageScopeItems(packageId: number): Promise<MentoringPackageScopeItem[]> {
    return await db
      .select()
      .from(mentoringPackageScopeItems)
      .where(eq(mentoringPackageScopeItems.packageId, packageId))
      .orderBy(mentoringPackageScopeItems.id);
  }

  async getMentoringPackagesByMentorship(
    mentorshipId: number,
  ): Promise<MentoringPackageWithScope[]> {
    const packages = await db
      .select()
      .from(mentoringPackages)
      .where(eq(mentoringPackages.mentorshipId, mentorshipId))
      .orderBy(desc(mentoringPackages.periodStart), desc(mentoringPackages.id));

    return await Promise.all(
      packages.map(async (mentoringPackage) => ({
        ...mentoringPackage,
        scopeItems: await this.getPackageScopeItems(mentoringPackage.id),
      })),
    );
  }

  async createScopeChangeRequest(
    data: InsertScopeChangeRequest,
    event: Omit<InsertScopeChangeEvent, "changeRequestId">,
  ): Promise<ScopeChangeRequest> {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(scopeChangeRequests)
        .values(data)
        .returning();

      await tx.insert(scopeChangeEvents).values({
        ...event,
        changeRequestId: created.id,
      });

      return created;
    });
  }

  async getScopeChangeRequest(id: number): Promise<ScopeChangeRequest | undefined> {
    const [request] = await db
      .select()
      .from(scopeChangeRequests)
      .where(eq(scopeChangeRequests.id, id));
    return request || undefined;
  }

  async getScopeChangeRequestsByMentorship(
    mentorshipId: number,
  ): Promise<ScopeChangeRequest[]> {
    return await db
      .select()
      .from(scopeChangeRequests)
      .where(eq(scopeChangeRequests.mentorshipId, mentorshipId))
      .orderBy(desc(scopeChangeRequests.createdAt), desc(scopeChangeRequests.id));
  }

  async transitionScopeChangeRequest(
    id: number,
    changes: Partial<ScopeChangeRequest>,
    event: Omit<InsertScopeChangeEvent, "changeRequestId">,
  ): Promise<ScopeChangeRequest | undefined> {
    return await db.transaction(async (tx) => {
      const {
        id: _id,
        mentorshipId: _mentorshipId,
        packageId: _packageId,
        requestedByUserId: _requestedByUserId,
        createdAt: _createdAt,
        ...safeChanges
      } = changes;

      const [updated] = await tx
        .update(scopeChangeRequests)
        .set({ ...safeChanges, updatedAt: new Date() })
        .where(eq(scopeChangeRequests.id, id))
        .returning();

      if (!updated) {
        return undefined;
      }

      await tx.insert(scopeChangeEvents).values({
        ...event,
        changeRequestId: id,
      });

      return updated;
    });
  }

  async getScopeChangeEvents(changeRequestId: number): Promise<ScopeChangeEvent[]> {
    return await db
      .select()
      .from(scopeChangeEvents)
      .where(eq(scopeChangeEvents.changeRequestId, changeRequestId))
      .orderBy(scopeChangeEvents.createdAt, scopeChangeEvents.id);
  }

  // Week methods
  async getAccessibleWeeks(userId: number, role: "MENTOR" | "LEARNER"): Promise<Week[]> {
    const accessibleRoadmaps = await this.getRoadmapsForUser(userId, role);
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
    const objectiveList = await this.getObjectivesByWeek(id);
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
