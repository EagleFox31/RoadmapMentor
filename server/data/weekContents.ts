import { db } from "../db";
import { eq, desc, inArray } from "drizzle-orm";
import {
  users,
  weeks,
  objectives,
  tasks,
  deliverables,
  resources,
  labs,
  labSubmissions,
  taskProgress,
  weekComments,
  type User,
  type Objective,
  type Task,
  type Deliverable,
  type Resource,
  type Lab,
  type LabSubmission,
  type TaskProgressWithLearner,
  type WeekComment,
} from "@shared/schema";

export type WeekContents = {
  objectives: Objective[];
  tasks: Task[];
  deliverables: Deliverable[];
  resources: Resource[];
  comments: (WeekComment & { learner: User })[];
  progress: TaskProgressWithLearner[];
  labs: Lab[];
  labSubmissions: LabSubmission[];
};

export interface WeekContentsStore {
  getWeekContentsByWeekIds(weekIds: number[]): Promise<WeekContents>;
}

export class WeekContentsRepository implements WeekContentsStore {
  // Loads every child row of the given weeks in a fixed number of queries.
  async getWeekContentsByWeekIds(weekIds: number[]): Promise<WeekContents> {
    if (weekIds.length === 0) {
      return { objectives: [], tasks: [], deliverables: [], resources: [], comments: [], progress: [], labs: [], labSubmissions: [] };
    }

    const [objectiveRows, deliverableRows, resourceRows, labRows, commentRows] = await Promise.all([
      db.select().from(objectives).where(inArray(objectives.weekId, weekIds)).orderBy(objectives.orderIndex),
      db.select().from(deliverables).where(inArray(deliverables.weekId, weekIds)),
      db.select().from(resources).where(inArray(resources.weekId, weekIds)),
      db.select().from(labs).where(inArray(labs.weekId, weekIds)).orderBy(labs.orderIndex, labs.id),
      db
        .select({ comment: weekComments, learner: users })
        .from(weekComments)
        .innerJoin(users, eq(weekComments.learnerId, users.id))
        .where(inArray(weekComments.weekId, weekIds))
        .orderBy(desc(weekComments.createdAt)),
    ]);

    const objectiveIds = objectiveRows.map((objective) => objective.id);
    const taskRows = objectiveIds.length
      ? await db.select().from(tasks).where(inArray(tasks.objectiveId, objectiveIds)).orderBy(tasks.orderIndex)
      : [];

    const taskIds = taskRows.map((task) => task.id);
    const progressRows = taskIds.length
      ? await db
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
          .where(inArray(taskProgress.taskId, taskIds))
      : [];

    const labIds = labRows.map((lab) => lab.id);
    const labSubmissionRows = labIds.length
      ? await db
          .select()
          .from(labSubmissions)
          .where(inArray(labSubmissions.labId, labIds))
          .orderBy(desc(labSubmissions.updatedAt))
      : [];

    return {
      objectives: objectiveRows,
      tasks: taskRows,
      deliverables: deliverableRows,
      resources: resourceRows,
      comments: commentRows.map(({ comment, learner }) => ({ ...comment, learner })),
      progress: progressRows,
      labs: labRows,
      labSubmissions: labSubmissionRows,
    };
  }
}
