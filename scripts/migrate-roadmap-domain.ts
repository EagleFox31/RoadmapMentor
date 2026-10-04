import { eq, isNull } from "drizzle-orm";
import { db, pool } from "../server/db";
import { buildLegacyMentorshipPairs } from "../server/domain/legacyRoadmapMigration";
import {
  mentorships,
  roadmaps,
  users,
  weeks,
} from "../shared/schema";

async function run() {
  const legacyRoadmaps = await db
    .select()
    .from(roadmaps)
    .where(eq(roadmaps.isLegacy, true))
    .orderBy(roadmaps.id);

  if (legacyRoadmaps.length > 1) {
    throw new Error(
      `Expected at most one legacy roadmap, found ${legacyRoadmaps.length}. Refusing to guess which roadmap owns pre-migration data.`,
    );
  }

  const unassignedWeeks = await db
    .select({ id: weeks.id })
    .from(weeks)
    .where(isNull(weeks.roadmapId))
    .orderBy(weeks.id);

  if (legacyRoadmaps.length === 0 && unassignedWeeks.length === 0) {
    console.log("[roadmap-domain] Nothing to migrate.");
    return;
  }

  const mentors = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "MENTOR"))
    .orderBy(users.id);

  if (mentors.length === 0) {
    throw new Error(
      "Legacy roadmap migration requires at least one existing MENTOR user.",
    );
  }

  const learners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "LEARNER"))
    .orderBy(users.id);

  let legacyRoadmap = legacyRoadmaps[0];

  if (!legacyRoadmap) {
    [legacyRoadmap] = await db
      .insert(roadmaps)
      .values({
        title: "Legacy Roadmap",
        description:
          "Migrated from the pre-roadmap global learning program.",
        createdByUserId: mentors[0].id,
        isLegacy: true,
      })
      .returning();

    console.log(
      `[roadmap-domain] Created legacy roadmap #${legacyRoadmap.id}.`,
    );
  }

  if (unassignedWeeks.length > 0) {
    await db
      .update(weeks)
      .set({ roadmapId: legacyRoadmap.id })
      .where(isNull(weeks.roadmapId));

    console.log(
      `[roadmap-domain] Attached ${unassignedWeeks.length} existing week(s) to legacy roadmap #${legacyRoadmap.id}.`,
    );
  }

  const pairs = buildLegacyMentorshipPairs(
    mentors.map(({ id }) => id),
    learners.map(({ id }) => id),
  );

  const existingMemberships = await db
    .select()
    .from(mentorships)
    .where(eq(mentorships.roadmapId, legacyRoadmap.id));

  const existingPairs = new Set(
    existingMemberships.map(
      (membership) => `${membership.mentorId}:${membership.learnerId}`,
    ),
  );

  let createdMemberships = 0;

  for (const pair of pairs) {
    const pairKey = `${pair.mentorId}:${pair.learnerId}`;
    if (existingPairs.has(pairKey)) {
      continue;
    }

    await db.insert(mentorships).values({
      roadmapId: legacyRoadmap.id,
      mentorId: pair.mentorId,
      learnerId: pair.learnerId,
      status: "ACTIVE",
    });
    existingPairs.add(pairKey);
    createdMemberships++;
  }

  console.log(
    `[roadmap-domain] Legacy access reconciliation complete: ${pairs.length} mentor/learner pair(s), ${createdMemberships} membership(s) created.`,
  );
}

run()
  .catch((error) => {
    console.error("[roadmap-domain] Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
