ALTER TABLE "resources" ADD COLUMN "is_approved" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "unavailable_reported_at" timestamp;--> statement-breakpoint
CREATE TABLE "resource_consultations" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_consultations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
  "resource_id" integer NOT NULL,
  "learner_id" integer NOT NULL,
  "consulted_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "resource_consultations" ADD CONSTRAINT "resource_consultations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_consultations" ADD CONSTRAINT "resource_consultations_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_consultations_resource_learner_unique" ON "resource_consultations" USING btree ("resource_id","learner_id");--> statement-breakpoint
CREATE INDEX "resource_consultations_learner_id_idx" ON "resource_consultations" USING btree ("learner_id");
