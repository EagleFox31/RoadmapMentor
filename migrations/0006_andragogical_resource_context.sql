ALTER TABLE "resources" ADD COLUMN "problem_to_solve" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "practice_prompt" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "is_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;
