import { z } from "zod";
import { bulkWeekSchema } from "@shared/schema";

// File format consumed by `npm run roadmap:import`: a roadmap and its weeks, using the same
// nested week contract as the bulk creation endpoint. The roadmap id is assigned at import time.
export const roadmapImportSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200),
  description: z.string().trim().max(10000).optional(),
  weeks: z.array(bulkWeekSchema.omit({ roadmapId: true })).min(1, "At least one week is required"),
});

export type RoadmapImportFile = z.infer<typeof roadmapImportSchema>;

export type RoadmapImportOutcome = "create" | "fill" | "noop";

/**
 * Idempotent decision for importing a roadmap owned by a mentor, matched by title.
 * - no roadmap with this title: create it with its weeks;
 * - roadmap exists without weeks (interrupted import): add the weeks to it;
 * - roadmap exists with weeks: leave it untouched, mentor edits are never overwritten.
 */
export function planRoadmapImport(existingWeekCount: number | undefined): RoadmapImportOutcome {
  if (existingWeekCount === undefined) return "create";
  return existingWeekCount === 0 ? "fill" : "noop";
}
