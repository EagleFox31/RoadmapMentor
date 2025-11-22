import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["MENTOR", "LEARNER"]);
export const objectiveTypeEnum = pgEnum("objective_type", ["CONCEPT", "ALGO", "PROJECT", "OTHER"]);
export const resourceTypeEnum = pgEnum("resource_type", ["DOC", "VIDEO", "COURSE", "ARTICLE", "OTHER"]);

// Users table
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("LEARNER"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Weeks table
export const weeks = pgTable("weeks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  description: text("description"),
  isValidatedByMentor: boolean("is_validated_by_mentor").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Objectives table
export const objectives = pgTable("objectives", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weekId: integer("week_id").notNull().references(() => weeks.id, { onDelete: "cascade" }),
  type: objectiveTypeEnum("type").notNull().default("OTHER"),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  objectiveId: integer("objective_id").notNull().references(() => objectives.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Deliverables table
export const deliverables = pgTable("deliverables", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weekId: integer("week_id").notNull().references(() => weeks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Resources table
export const resources = pgTable("resources", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weekId: integer("week_id").notNull().references(() => weeks.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  resourceType: resourceTypeEnum("resource_type").notNull().default("OTHER"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Progress table (junction table for learner progress)
export const taskProgress = pgTable("task_progress", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  learnerId: integer("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isDone: boolean("is_done").notNull().default(false),
  screenshotUrl: text("screenshot_url"),
  doneAt: timestamp("done_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Week Comments table
export const weekComments = pgTable("week_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weekId: integer("week_id").notNull().references(() => weeks.id, { onDelete: "cascade" }),
  learnerId: integer("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  taskProgress: many(taskProgress),
  weekComments: many(weekComments),
}));

export const weeksRelations = relations(weeks, ({ many }) => ({
  objectives: many(objectives),
  deliverables: many(deliverables),
  resources: many(resources),
  comments: many(weekComments),
}));

export const objectivesRelations = relations(objectives, ({ one, many }) => ({
  week: one(weeks, {
    fields: [objectives.weekId],
    references: [weeks.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  objective: one(objectives, {
    fields: [tasks.objectiveId],
    references: [objectives.id],
  }),
  progress: many(taskProgress),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  week: one(weeks, {
    fields: [deliverables.weekId],
    references: [weeks.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  week: one(weeks, {
    fields: [resources.weekId],
    references: [weeks.id],
  }),
}));

export const taskProgressRelations = relations(taskProgress, ({ one }) => ({
  task: one(tasks, {
    fields: [taskProgress.taskId],
    references: [tasks.id],
  }),
  learner: one(users, {
    fields: [taskProgress.learnerId],
    references: [users.id],
  }),
}));

export const weekCommentsRelations = relations(weekComments, ({ one }) => ({
  week: one(weeks, {
    fields: [weekComments.weekId],
    references: [weeks.id],
  }),
  learner: one(users, {
    fields: [weekComments.learnerId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertWeekSchema = createInsertSchema(weeks).omit({
  id: true,
  createdAt: true,
  isValidatedByMentor: true,
});

export const insertObjectiveSchema = createInsertSchema(objectives).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertDeliverableSchema = createInsertSchema(deliverables).omit({
  id: true,
  createdAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
});

export const insertTaskProgressSchema = createInsertSchema(taskProgress).omit({
  id: true,
  createdAt: true,
  doneAt: true,
});

export const insertWeekCommentSchema = createInsertSchema(weekComments).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Week = typeof weeks.$inferSelect;
export type InsertWeek = z.infer<typeof insertWeekSchema>;

export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Deliverable = typeof deliverables.$inferSelect;
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type TaskProgress = typeof taskProgress.$inferSelect;
export type InsertTaskProgress = z.infer<typeof insertTaskProgressSchema>;

export type WeekComment = typeof weekComments.$inferSelect;
export type InsertWeekComment = z.infer<typeof insertWeekCommentSchema>;

// Extended types for frontend (with relations)
export type TaskProgressWithLearner = TaskProgress & {
  learner: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type ObjectiveWithTasks = Objective & {
  tasks: (Task & { progress?: TaskProgressWithLearner[] })[];
};

export type WeekWithDetails = Week & {
  objectives: ObjectiveWithTasks[];
  deliverables: Deliverable[];
  resources: Resource[];
  comments: (WeekComment & { learner: User })[];
};
