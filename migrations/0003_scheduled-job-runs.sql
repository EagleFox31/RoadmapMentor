CREATE TABLE "scheduled_job_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scheduled_job_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"job_name" text NOT NULL,
	"run_key" text NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"result" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_job_runs_job_run_unique" ON "scheduled_job_runs" USING btree ("job_name","run_key");