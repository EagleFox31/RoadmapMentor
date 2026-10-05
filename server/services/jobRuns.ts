import { and, eq } from "drizzle-orm";
import { scheduledJobRuns } from "@shared/schema";
import { db } from "../db";

/**
 * Tries to claim the execution of a job for a given scheduled slot.
 * Exactly one caller across all instances (and across restarts) gets `true` for a (job, runKey) pair.
 */
export async function claimJobRun(jobName: string, runKey: string): Promise<boolean> {
  const inserted = await db
    .insert(scheduledJobRuns)
    .values({ jobName, runKey })
    .onConflictDoNothing({ target: [scheduledJobRuns.jobName, scheduledJobRuns.runKey] })
    .returning({ id: scheduledJobRuns.id });
  return inserted.length > 0;
}

export async function finishJobRun(
  jobName: string,
  runKey: string,
  status: "SUCCEEDED" | "FAILED",
  result: string,
): Promise<void> {
  await db
    .update(scheduledJobRuns)
    .set({ status, result, finishedAt: new Date() })
    .where(and(eq(scheduledJobRuns.jobName, jobName), eq(scheduledJobRuns.runKey, runKey)));
}
