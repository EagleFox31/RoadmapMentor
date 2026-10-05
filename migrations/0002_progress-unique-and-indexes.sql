-- Remove pre-existing duplicate progress rows (keep the done one, then the latest) so the unique index can be built.
DELETE FROM "task_progress" tp USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "task_id", "learner_id" ORDER BY "is_done" DESC, "id" DESC) AS rn
  FROM "task_progress"
) d WHERE tp."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE INDEX "deliverables_week_id_idx" ON "deliverables" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX "objectives_week_id_idx" ON "objectives" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX "resources_week_id_idx" ON "resources" USING btree ("week_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_progress_task_learner_unique" ON "task_progress" USING btree ("task_id","learner_id");--> statement-breakpoint
CREATE INDEX "task_progress_learner_id_idx" ON "task_progress" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "tasks_objective_id_idx" ON "tasks" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "week_comments_week_id_idx" ON "week_comments" USING btree ("week_id");