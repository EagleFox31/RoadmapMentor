import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["MENTOR", "LEARNER"]);
export const objectiveTypeEnum = pgEnum("objective_type", ["CONCEPT", "ALGO", "PROJECT", "OTHER"]);
export const resourceTypeEnum = pgEnum("resource_type", ["DOC", "VIDEO", "COURSE", "ARTICLE", "OTHER"]);
export const mentorshipStatusEnum = pgEnum("mentorship_status", ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);
export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "PROPOSED",
  "QUOTED",
  "ACCEPTED",
  "REJECTED",
  "DELIVERED",
]);
export const mentoringSessionStatusEnum = pgEnum("mentoring_session_status", [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export const billingStatusEnum = pgEnum("billing_status", [
  "DUE",
  "PARTIALLY_PAID",
  "PAID",
  "VOID",
]);
export const billingChargeTypeEnum = pgEnum("billing_charge_type", [
  "CHANGE_REQUEST",
  "ADDITIONAL_SESSION",
  "MANUAL",
]);
export const paymentProviderEnum = pgEnum("payment_provider", [
  "MANUAL",
]);

// Users table
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("LEARNER"),
  disabledAt: timestamp("disabled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Roadmaps are first-class learning programs. Access is granted through mentorships.
export const roadmaps = pgTable("roadmaps", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isLegacy: boolean("is_legacy").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mentorships = pgTable(
  "mentorships",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    roadmapId: integer("roadmap_id").notNull().references(() => roadmaps.id, { onDelete: "cascade" }),
    mentorId: integer("mentor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: mentorshipStatusEnum("status").notNull().default("ACTIVE"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEngagement: uniqueIndex("mentorship_unique_engagement").on(
      table.roadmapId,
      table.mentorId,
      table.learnerId,
    ),
  }),
);

// Monthly or fixed-period commercial terms for one mentorship.
// Packages are append-only: when terms change, create a new package instead of
// rewriting the historical agreement.
export const mentoringPackages = pgTable("mentoring_packages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mentorshipId: integer("mentorship_id").notNull().references(() => mentorships.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  basePriceMinor: integer("base_price_minor").notNull(),
  currency: text("currency").notNull().default("XAF"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  includedSessionCount: integer("included_session_count").notNull().default(0),
  includedSessionDurationMinutes: integer("included_session_duration_minutes"),
  sessionSchedule: text("session_schedule"),
  scopeDescription: text("scope_description").notNull(),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mentoringPackageScopeItems = pgTable("mentoring_package_scope_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  packageId: integer("package_id").notNull().references(() => mentoringPackages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


// Weeks table
export const weeks = pgTable("weeks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roadmapId: integer("roadmap_id").references(() => roadmaps.id, { onDelete: "cascade" }),
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

export const changeRequests = pgTable("change_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mentorshipId: integer("mentorship_id").notNull().references(() => mentorships.id, { onDelete: "cascade" }),
  packageId: integer("package_id").references(() => mentoringPackages.id, { onDelete: "set null" }),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: changeRequestStatusEnum("status").notNull().default("PROPOSED"),
  quotedPriceMinor: integer("quoted_price_minor"),
  currency: text("currency").notNull().default("XAF"),
  linkedTaskId: integer("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
  quotedAt: timestamp("quoted_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mentoringSessions = pgTable("mentoring_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mentorshipId: integer("mentorship_id").notNull().references(() => mentorships.id, { onDelete: "cascade" }),
  packageId: integer("package_id").references(() => mentoringPackages.id, { onDelete: "set null" }),
  weekId: integer("week_id").references(() => weeks.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: mentoringSessionStatusEnum("status").notNull().default("SCHEDULED"),
  isAdditional: boolean("is_additional").notNull().default(false),
  additionalPriceMinor: integer("additional_price_minor"),
  additionalPriceCurrency: text("additional_price_currency"),
  learnerAttended: boolean("learner_attended"),
  mentorNotes: text("mentor_notes"),
  calendarProvider: text("calendar_provider"),
  calendarEventId: text("calendar_event_id"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const billingPeriods = pgTable(
  "billing_periods",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    mentorshipId: integer("mentorship_id").notNull().references(() => mentorships.id, { onDelete: "cascade" }),
    packageId: integer("package_id").references(() => mentoringPackages.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    currency: text("currency").notNull().default("XAF"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    dueDate: text("due_date").notNull(),
    baseAmountMinor: integer("base_amount_minor").notNull(),
    status: billingStatusEnum("status").notNull().default("DUE"),
    createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniquePackageBilling: uniqueIndex("billing_period_package_unique").on(table.packageId),
  }),
);

export const billingCharges = pgTable(
  "billing_charges",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    billingPeriodId: integer("billing_period_id").notNull().references(() => billingPeriods.id, { onDelete: "cascade" }),
    type: billingChargeTypeEnum("type").notNull(),
    description: text("description").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    changeRequestId: integer("change_request_id").references(() => changeRequests.id, { onDelete: "set null" }),
    sessionId: integer("session_id").references(() => mentoringSessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueChangeRequestCharge: uniqueIndex("billing_charge_change_request_unique").on(table.changeRequestId),
    uniqueSessionCharge: uniqueIndex("billing_charge_session_unique").on(table.sessionId),
  }),
);

export const payments = pgTable("payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  billingPeriodId: integer("billing_period_id").notNull().references(() => billingPeriods.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("XAF"),
  provider: paymentProviderEnum("provider").notNull().default("MANUAL"),
  providerReference: text("provider_reference"),
  method: text("method"),
  note: text("note"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  recordedByUserId: integer("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
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

// Email notification preferences
export const emailNotificationTypeEnum = pgEnum("email_notification_type", [
  // Existing notifications
  "TASK_REMINDER",
  "WEEK_PREPARATION",
  "PROGRESS_UPDATE",
  "COMMENT_NOTIFICATION",
  // AI/System notifications
  "AI_GENERATION_SUCCESS",
  "AI_GENERATION_FAILURE",
  "WEEK_VALIDATION",
  // Collaboration notifications
  "NEW_TASK_ASSIGNED",
  "SCREENSHOT_UPLOADED",
  "WEEK_MODIFIED",
  // Intelligent reminders
  "DEADLINE_APPROACHING",
  "STREAK_WARNING",
  // Gamification notifications
  "MILESTONE_REACHED",
  "BADGE_UNLOCKED",
  "WEEKLY_REPORT"
]);

export const emailNotificationPreferences = pgTable("email_notification_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  // Existing preferences
  taskReminders: boolean("task_reminders").notNull().default(true),
  weekPreparation: boolean("week_preparation").notNull().default(true),
  progressUpdates: boolean("progress_updates").notNull().default(true),
  commentNotifications: boolean("comment_notifications").notNull().default(true),
  // AI/System notifications preferences
  aiGenerationNotifications: boolean("ai_generation_notifications").notNull().default(true),
  weekValidationNotifications: boolean("week_validation_notifications").notNull().default(true),
  // Collaboration notifications preferences
  newTaskNotifications: boolean("new_task_notifications").notNull().default(true),
  screenshotNotifications: boolean("screenshot_notifications").notNull().default(true),
  weekModifiedNotifications: boolean("week_modified_notifications").notNull().default(true),
  // Intelligent reminders preferences
  deadlineReminders: boolean("deadline_reminders").notNull().default(true),
  streakWarnings: boolean("streak_warnings").notNull().default(true),
  // Gamification preferences
  milestoneNotifications: boolean("milestone_notifications").notNull().default(true),
  badgeNotifications: boolean("badge_notifications").notNull().default(true),
  weeklyReports: boolean("weekly_reports").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email notifications log (pour tracer les envois)
export const emailNotifications = pgTable("email_notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: emailNotificationTypeEnum("type").notNull(),
  subject: text("subject").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  taskProgress: many(taskProgress),
  weekComments: many(weekComments),
  createdRoadmaps: many(roadmaps),
  mentorMentorships: many(mentorships, { relationName: "mentorMentorships" }),
  learnerMentorships: many(mentorships, { relationName: "learnerMentorships" }),
  createdMentoringPackages: many(mentoringPackages),
  requestedChangeRequests: many(changeRequests),
  createdMentoringSessions: many(mentoringSessions),
  createdBillingPeriods: many(billingPeriods),
  recordedPayments: many(payments),
}));

export const roadmapsRelations = relations(roadmaps, ({ one, many }) => ({
  creator: one(users, {
    fields: [roadmaps.createdByUserId],
    references: [users.id],
  }),
  weeks: many(weeks),
  mentorships: many(mentorships),
}));

export const mentorshipsRelations = relations(mentorships, ({ one, many }) => ({
  roadmap: one(roadmaps, {
    fields: [mentorships.roadmapId],
    references: [roadmaps.id],
  }),
  mentor: one(users, {
    fields: [mentorships.mentorId],
    references: [users.id],
    relationName: "mentorMentorships",
  }),
  learner: one(users, {
    fields: [mentorships.learnerId],
    references: [users.id],
    relationName: "learnerMentorships",
  }),
  packages: many(mentoringPackages),
  changeRequests: many(changeRequests),
  sessions: many(mentoringSessions),
  billingPeriods: many(billingPeriods),
}));

export const mentoringPackagesRelations = relations(mentoringPackages, ({ one, many }) => ({
  mentorship: one(mentorships, {
    fields: [mentoringPackages.mentorshipId],
    references: [mentorships.id],
  }),
  createdBy: one(users, {
    fields: [mentoringPackages.createdByUserId],
    references: [users.id],
  }),
  scopeItems: many(mentoringPackageScopeItems),
  changeRequests: many(changeRequests),
  sessions: many(mentoringSessions),
  billingPeriods: many(billingPeriods),
}));

export const mentoringPackageScopeItemsRelations = relations(mentoringPackageScopeItems, ({ one }) => ({
  package: one(mentoringPackages, {
    fields: [mentoringPackageScopeItems.packageId],
    references: [mentoringPackages.id],
  }),
}));

export const changeRequestsRelations = relations(changeRequests, ({ one }) => ({
  mentorship: one(mentorships, {
    fields: [changeRequests.mentorshipId],
    references: [mentorships.id],
  }),
  package: one(mentoringPackages, {
    fields: [changeRequests.packageId],
    references: [mentoringPackages.id],
  }),
  requestedBy: one(users, {
    fields: [changeRequests.requestedByUserId],
    references: [users.id],
  }),
  linkedTask: one(tasks, {
    fields: [changeRequests.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const weeksRelations = relations(weeks, ({ one, many }) => ({
  roadmap: one(roadmaps, {
    fields: [weeks.roadmapId],
    references: [roadmaps.id],
  }),
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

export const mentoringSessionsRelations = relations(mentoringSessions, ({ one }) => ({
  mentorship: one(mentorships, {
    fields: [mentoringSessions.mentorshipId],
    references: [mentorships.id],
  }),
  package: one(mentoringPackages, {
    fields: [mentoringSessions.packageId],
    references: [mentoringPackages.id],
  }),
  week: one(weeks, {
    fields: [mentoringSessions.weekId],
    references: [weeks.id],
  }),
  createdBy: one(users, {
    fields: [mentoringSessions.createdByUserId],
    references: [users.id],
  }),
}));

export const billingPeriodsRelations = relations(billingPeriods, ({ one, many }) => ({
  mentorship: one(mentorships, {
    fields: [billingPeriods.mentorshipId],
    references: [mentorships.id],
  }),
  package: one(mentoringPackages, {
    fields: [billingPeriods.packageId],
    references: [mentoringPackages.id],
  }),
  createdBy: one(users, {
    fields: [billingPeriods.createdByUserId],
    references: [users.id],
  }),
  charges: many(billingCharges),
  payments: many(payments),
}));

export const billingChargesRelations = relations(billingCharges, ({ one }) => ({
  billingPeriod: one(billingPeriods, {
    fields: [billingCharges.billingPeriodId],
    references: [billingPeriods.id],
  }),
  changeRequest: one(changeRequests, {
    fields: [billingCharges.changeRequestId],
    references: [changeRequests.id],
  }),
  session: one(mentoringSessions, {
    fields: [billingCharges.sessionId],
    references: [mentoringSessions.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  billingPeriod: one(billingPeriods, {
    fields: [payments.billingPeriodId],
    references: [billingPeriods.id],
  }),
  recordedBy: one(users, {
    fields: [payments.recordedByUserId],
    references: [users.id],
  }),
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
  createdAt: true,
});

export const publicRegistrationSchema = insertUserSchema
  .omit({ role: true })
  .strict();

export const insertRoadmapSchema = createInsertSchema(roadmaps).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMentorshipSchema = createInsertSchema(mentorships).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMentoringPackageSchema = createInsertSchema(mentoringPackages)
  .omit({ createdAt: true })
  .extend({
    basePriceMinor: z.number().int().nonnegative(),
    currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    includedSessionCount: z.number().int().nonnegative(),
    includedSessionDurationMinutes: z.number().int().positive().nullable().optional(),
    sessionSchedule: z.string().trim().min(1).nullable().optional(),
    scopeDescription: z.string().trim().min(1),
  });

export const insertMentoringPackageScopeItemSchema = createInsertSchema(mentoringPackageScopeItems).omit({
  createdAt: true,
});

export const createMentoringPackageSchema = insertMentoringPackageSchema
  .omit({ mentorshipId: true, createdByUserId: true })
  .extend({
    scopeItems: z.array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1).nullable().optional(),
      }),
    ).min(1, "At least one included scope item is required"),
  })
  .strict()
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "periodEnd must be on or after periodStart",
    path: ["periodEnd"],
  });

export const insertChangeRequestSchema = createInsertSchema(changeRequests).omit({
  quotedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
});

export const createChangeRequestSchema = z.object({
  packageId: z.number().int().positive(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
}).strict();

export const quoteChangeRequestSchema = z.object({
  quotedPriceMinor: z.number().int().nonnegative(),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  linkedTaskId: z.number().int().positive(),
}).strict();

export const changeRequestDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
}).strict();

export const insertWeekSchema = createInsertSchema(weeks).omit({
  createdAt: true,
  isValidatedByMentor: true,
});

// Schema for AI roadmap generation request
export const aiRoadmapRequestSchema = z.object({
  topic: z.string().min(3, "Le sujet doit contenir au moins 3 caractères"),
  numberOfWeeks: z.number().int().min(1).max(12),
  skillLevel: z.enum(["débutant", "intermédiaire", "avancé"]),
  additionalContext: z.string().optional(),
  startWeekNumber: z.number().int().positive().optional(), // Optional: start from specific week number
  baseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Optional: base date to start from (YYYY-MM-DD)
}).refine(
  (data) => {
    // CRITICAL VALIDATION: baseDate is REQUIRED whenever startWeekNumber is provided
    // This ensures explicit timeline control and chronological continuity
    if (data.startWeekNumber && !data.baseDate) {
      return false;
    }
    return true;
  },
  {
    message: "baseDate is required when startWeekNumber is provided to ensure explicit timeline control",
    path: ["baseDate"],
  }
);

export type AIRoadmapRequest = z.infer<typeof aiRoadmapRequestSchema>;

export const insertObjectiveSchema = createInsertSchema(objectives).omit({
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  createdAt: true,
});

export const insertMentoringSessionSchema = createInsertSchema(mentoringSessions).omit({
  createdAt: true,
  updatedAt: true,
});

export const scheduleMentoringSessionSchema = z.object({
  packageId: z.number().int().positive().nullable().optional(),
  weekId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  isAdditional: z.boolean().default(false),
  additionalPriceMinor: z.number().int().positive().nullable().optional(),
  additionalPriceCurrency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()).nullable().optional(),
  calendarProvider: z.string().trim().min(1).nullable().optional(),
  calendarEventId: z.string().trim().min(1).nullable().optional(),
})
  .strict()
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  })
  .refine((data) => data.isAdditional || Boolean(data.packageId), {
    message: "packageId is required for an included session",
    path: ["packageId"],
  })
  .refine(
    (data) =>
      !data.isAdditional ||
      (Boolean(data.additionalPriceMinor) && Boolean(data.additionalPriceCurrency)),
    {
      message: "additionalPriceMinor and additionalPriceCurrency are required for an additional session",
      path: ["additionalPriceMinor"],
    },
  );

export const completeMentoringSessionSchema = z.object({
  learnerAttended: z.boolean(),
  mentorNotes: z.string().trim().max(5000).nullable().optional(),
}).strict();

export const insertBillingPeriodSchema = createInsertSchema(billingPeriods)
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseAmountMinor: z.number().int().nonnegative(),
  });

export const createBillingPeriodSchema = z.object({
  packageId: z.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export const insertBillingChargeSchema = createInsertSchema(billingCharges).omit({
  createdAt: true,
});

export const manualBillingChargeSchema = z.object({
  description: z.string().trim().min(1),
  amountMinor: z.number().int().positive(),
}).strict();

export const insertPaymentSchema = createInsertSchema(payments).omit({
  createdAt: true,
});

export const recordManualPaymentSchema = z.object({
  amountMinor: z.number().int().positive(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  method: z.string().trim().min(1).max(100).nullable().optional(),
  providerReference: z.string().trim().min(1).max(200).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const insertDeliverableSchema = createInsertSchema(deliverables).omit({
  createdAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  createdAt: true,
});

export const insertTaskProgressSchema = createInsertSchema(taskProgress).omit({
  createdAt: true,
  doneAt: true,
});

export const insertWeekCommentSchema = createInsertSchema(weekComments).omit({
  createdAt: true,
});

export const insertEmailNotificationPreferencesSchema = createInsertSchema(emailNotificationPreferences).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateEmailNotificationPreferencesSchema = insertEmailNotificationPreferencesSchema
  .omit({ userId: true })
  .partial()
  .strict();

export const insertEmailNotificationSchema = createInsertSchema(emailNotifications).omit({
  sentAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Roadmap = typeof roadmaps.$inferSelect;
export type InsertRoadmap = z.infer<typeof insertRoadmapSchema>;

export type Mentorship = typeof mentorships.$inferSelect;
export type InsertMentorship = z.infer<typeof insertMentorshipSchema>;

export type MentoringPackage = typeof mentoringPackages.$inferSelect;
export type InsertMentoringPackage = z.infer<typeof insertMentoringPackageSchema>;

export type MentoringPackageScopeItem = typeof mentoringPackageScopeItems.$inferSelect;
export type InsertMentoringPackageScopeItem = z.infer<typeof insertMentoringPackageScopeItemSchema>;

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;

export type MentoringPackageWithScope = MentoringPackage & {
  scopeItems: MentoringPackageScopeItem[];
};

export type Week = typeof weeks.$inferSelect;
export type InsertWeek = z.infer<typeof insertWeekSchema>;

export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type MentoringSession = typeof mentoringSessions.$inferSelect;
export type InsertMentoringSession = z.infer<typeof insertMentoringSessionSchema>;

export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type InsertBillingPeriod = z.infer<typeof insertBillingPeriodSchema>;

export type BillingCharge = typeof billingCharges.$inferSelect;
export type InsertBillingCharge = z.infer<typeof insertBillingChargeSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type BillingPeriodWithDetails = BillingPeriod & {
  charges: BillingCharge[];
  payments: Payment[];
  extrasMinor: number;
  subtotalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
};

export type Deliverable = typeof deliverables.$inferSelect;
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type TaskProgress = typeof taskProgress.$inferSelect;
export type InsertTaskProgress = z.infer<typeof insertTaskProgressSchema>;

export type WeekComment = typeof weekComments.$inferSelect;
export type InsertWeekComment = z.infer<typeof insertWeekCommentSchema>;

export type EmailNotificationPreferences = typeof emailNotificationPreferences.$inferSelect;
export type InsertEmailNotificationPreferences = z.infer<typeof insertEmailNotificationPreferencesSchema>;
export type UpdateEmailNotificationPreferences = z.infer<typeof updateEmailNotificationPreferencesSchema>;

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = z.infer<typeof insertEmailNotificationSchema>;

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

// Bulk roadmap creation schemas (nested)
// These schemas allow creating weeks with nested objectives, tasks, deliverables, and resources in a single transaction

// Task schema for bulk creation (without weekId/objectiveId as they'll be set during insertion)
export const bulkTaskSchema = insertTaskSchema.omit({ 
  objectiveId: true 
}).extend({
  // Add a temporary ID for matching after insertion
  tempId: z.string().optional(),
});

// Objective schema with nested tasks
export const bulkObjectiveSchema = insertObjectiveSchema.omit({ 
  weekId: true 
}).extend({
  tempId: z.string().optional(),
  tasks: z.array(bulkTaskSchema).min(1, "Each objective must have at least one task"),
});

// Week schema with all nested entities
export const bulkWeekSchema = insertWeekSchema.extend({
  number: z.number().int().positive(),
  objectives: z.array(bulkObjectiveSchema).min(1, "Each week must have at least one objective"),
  deliverables: z.array(insertDeliverableSchema.omit({ weekId: true })).default([]),
  resources: z.array(insertResourceSchema.omit({ weekId: true })).default([]),
});

// Array of weeks for bulk roadmap creation
export const insertRoadmapBulkSchema = z.array(bulkWeekSchema).min(1, "At least one week is required");

// Types for bulk creation
export type BulkTask = z.infer<typeof bulkTaskSchema>;
export type BulkObjective = z.infer<typeof bulkObjectiveSchema>;
export type BulkWeek = z.infer<typeof bulkWeekSchema>;
export type RoadmapBulkInsert = z.infer<typeof insertRoadmapBulkSchema>;

// Response type for bulk creation (with generated IDs)
export type BulkCreatedTask = {
  id: number;
  tempId?: string;
};

export type BulkCreatedObjective = {
  id: number;
  tempId?: string;
  tasks: BulkCreatedTask[];
};

export type BulkCreatedWeek = {
  id: number;
  number: number;
  objectives: BulkCreatedObjective[];
  deliverables: Array<{ id: number }>;
  resources: Array<{ id: number }>;
};

export type RoadmapBulkCreateResponse = {
  weeks: BulkCreatedWeek[];
};
