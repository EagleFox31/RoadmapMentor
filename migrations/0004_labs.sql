CREATE TYPE "public"."lab_difficulty" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."lab_submission_status" AS ENUM('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TABLE "lab_submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lab_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lab_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"status" "lab_submission_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"output" text,
	"mentor_feedback" text,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "labs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"difficulty" "lab_difficulty" DEFAULT 'BEGINNER' NOT NULL,
	"estimated_minutes" integer DEFAULT 30 NOT NULL,
	"starter_code" text,
	"test_code" text,
	"repository_url" text,
	"launch_url" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_submissions" ADD CONSTRAINT "lab_submissions_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_submissions" ADD CONSTRAINT "lab_submissions_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs" ADD CONSTRAINT "labs_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_submission_lab_learner_unique" ON "lab_submissions" USING btree ("lab_id","learner_id");