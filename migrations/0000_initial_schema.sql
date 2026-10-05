CREATE TYPE "public"."billing_charge_type" AS ENUM('CHANGE_REQUEST', 'ADDITIONAL_SESSION', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('DUE', 'PARTIALLY_PAID', 'PAID', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('PROPOSED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."email_notification_type" AS ENUM('TASK_REMINDER', 'WEEK_PREPARATION', 'PROGRESS_UPDATE', 'COMMENT_NOTIFICATION', 'AI_GENERATION_SUCCESS', 'AI_GENERATION_FAILURE', 'WEEK_VALIDATION', 'NEW_TASK_ASSIGNED', 'SCREENSHOT_UPLOADED', 'WEEK_MODIFIED', 'DEADLINE_APPROACHING', 'STREAK_WARNING', 'MILESTONE_REACHED', 'BADGE_UNLOCKED', 'WEEKLY_REPORT');--> statement-breakpoint
CREATE TYPE "public"."mentoring_session_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."mentorship_status" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."objective_type" AS ENUM('CONCEPT', 'ALGO', 'PROJECT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('MANUAL');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('DOC', 'VIDEO', 'COURSE', 'ARTICLE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('MENTOR', 'LEARNER');--> statement-breakpoint
CREATE TABLE "billing_charges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_charges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"billing_period_id" integer NOT NULL,
	"type" "billing_charge_type" NOT NULL,
	"description" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"change_request_id" integer,
	"session_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_periods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mentorship_id" integer NOT NULL,
	"package_id" integer,
	"title" text NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"due_date" text NOT NULL,
	"base_amount_minor" integer NOT NULL,
	"status" "billing_status" DEFAULT 'DUE' NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "change_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mentorship_id" integer NOT NULL,
	"package_id" integer,
	"requested_by_user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "change_request_status" DEFAULT 'PROPOSED' NOT NULL,
	"quoted_price_minor" integer,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"linked_task_id" integer,
	"quoted_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deliverables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_notification_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_notification_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"task_reminders" boolean DEFAULT true NOT NULL,
	"week_preparation" boolean DEFAULT true NOT NULL,
	"progress_updates" boolean DEFAULT true NOT NULL,
	"comment_notifications" boolean DEFAULT true NOT NULL,
	"ai_generation_notifications" boolean DEFAULT true NOT NULL,
	"week_validation_notifications" boolean DEFAULT true NOT NULL,
	"new_task_notifications" boolean DEFAULT true NOT NULL,
	"screenshot_notifications" boolean DEFAULT true NOT NULL,
	"week_modified_notifications" boolean DEFAULT true NOT NULL,
	"deadline_reminders" boolean DEFAULT true NOT NULL,
	"streak_warnings" boolean DEFAULT true NOT NULL,
	"milestone_notifications" boolean DEFAULT true NOT NULL,
	"badge_notifications" boolean DEFAULT true NOT NULL,
	"weekly_reports" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "email_notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"type" "email_notification_type" NOT NULL,
	"subject" text NOT NULL,
	"recipient_email" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "mentoring_package_scope_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mentoring_package_scope_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"package_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentoring_packages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mentoring_packages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mentorship_id" integer NOT NULL,
	"title" text NOT NULL,
	"base_price_minor" integer NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"included_session_count" integer DEFAULT 0 NOT NULL,
	"included_session_duration_minutes" integer,
	"session_schedule" text,
	"scope_description" text NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentoring_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mentoring_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mentorship_id" integer NOT NULL,
	"package_id" integer,
	"week_id" integer,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "mentoring_session_status" DEFAULT 'SCHEDULED' NOT NULL,
	"is_additional" boolean DEFAULT false NOT NULL,
	"additional_price_minor" integer,
	"additional_price_currency" text,
	"learner_attended" boolean,
	"mentor_notes" text,
	"calendar_provider" text,
	"calendar_event_id" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mentorships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"roadmap_id" integer NOT NULL,
	"mentor_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"status" "mentorship_status" DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "objectives_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"type" "objective_type" DEFAULT 'OTHER' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"billing_period_id" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"provider" "payment_provider" DEFAULT 'MANUAL' NOT NULL,
	"provider_reference" text,
	"method" text,
	"note" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"resource_type" "resource_type" DEFAULT 'OTHER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roadmaps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"created_by_user_id" integer,
	"is_legacy" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"screenshot_url" text,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"objective_id" integer NOT NULL,
	"label" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" "role" DEFAULT 'LEARNER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "week_comments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "week_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weeks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"roadmap_id" integer,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"description" text,
	"is_validated_by_mentor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_session_id_mentoring_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mentoring_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_mentorship_id_mentorships_id_fk" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_package_id_mentoring_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."mentoring_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_mentorship_id_mentorships_id_fk" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_package_id_mentoring_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."mentoring_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_linked_task_id_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notification_preferences" ADD CONSTRAINT "email_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_package_scope_items" ADD CONSTRAINT "mentoring_package_scope_items_package_id_mentoring_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."mentoring_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_packages" ADD CONSTRAINT "mentoring_packages_mentorship_id_mentorships_id_fk" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_packages" ADD CONSTRAINT "mentoring_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_mentorship_id_mentorships_id_fk" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_package_id_mentoring_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."mentoring_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress" ADD CONSTRAINT "task_progress_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress" ADD CONSTRAINT "task_progress_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_comments" ADD CONSTRAINT "week_comments_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_comments" ADD CONSTRAINT "week_comments_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_charge_change_request_unique" ON "billing_charges" USING btree ("change_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_charge_session_unique" ON "billing_charges" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_period_package_unique" ON "billing_periods" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_unique_engagement" ON "mentorships" USING btree ("roadmap_id","mentor_id","learner_id");