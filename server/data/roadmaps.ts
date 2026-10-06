import { db } from "../db";
import { eq, and, ne } from "drizzle-orm";
import {
  roadmaps,
  mentorships,
  type Roadmap,
  type InsertRoadmap,
  type Mentorship,
  type InsertMentorship,
} from "@shared/schema";
import { hasRoadmapAccess } from "../domain/roadmapAccess";

export interface RoadmapStore {
  getRoadmap(id: number): Promise<Roadmap | undefined>;
  getRoadmapsForUser(userId: number, role: "MENTOR" | "LEARNER"): Promise<Roadmap[]>;
  createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap>;
  createMentorship(mentorship: InsertMentorship): Promise<Mentorship>;
  getMentorship(id: number): Promise<Mentorship | undefined>;
  findMentorship(roadmapId: number, mentorId: number, learnerId: number): Promise<Mentorship | undefined>;
  getMentorshipsByRoadmap(roadmapId: number): Promise<Mentorship[]>;
  userCanAccessRoadmap(userId: number, role: "MENTOR" | "LEARNER", roadmapId: number): Promise<boolean>;
}

export class RoadmapRepository implements RoadmapStore {
  // Roadmap / mentorship methods
  async getRoadmap(id: number): Promise<Roadmap | undefined> {
    const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    return roadmap || undefined;
  }

  async getRoadmapsForUser(userId: number, role: "MENTOR" | "LEARNER"): Promise<Roadmap[]> {
    const collected = new Map<number, Roadmap>();

    if (role === "MENTOR") {
      const owned = await db
        .select()
        .from(roadmaps)
        .where(eq(roadmaps.createdByUserId, userId));
      owned.forEach((roadmap) => collected.set(roadmap.id, roadmap));

      const legacy = await db
        .select()
        .from(roadmaps)
        .where(eq(roadmaps.isLegacy, true));
      legacy.forEach((roadmap) => collected.set(roadmap.id, roadmap));
    }

    const membershipRows = await db
      .select({ roadmap: roadmaps })
      .from(mentorships)
      .innerJoin(roadmaps, eq(mentorships.roadmapId, roadmaps.id))
      .where(
        and(
          role === "MENTOR"
            ? eq(mentorships.mentorId, userId)
            : eq(mentorships.learnerId, userId),
          ne(mentorships.status, "CANCELLED"),
        ),
      );

    membershipRows.forEach(({ roadmap }) => collected.set(roadmap.id, roadmap));
    return Array.from(collected.values()).sort((a, b) => a.id - b.id);
  }

  async createRoadmap(roadmap: InsertRoadmap): Promise<Roadmap> {
    const [created] = await db.insert(roadmaps).values(roadmap).returning();
    return created;
  }

  async createMentorship(mentorship: InsertMentorship): Promise<Mentorship> {
    const [created] = await db.insert(mentorships).values(mentorship).returning();
    return created;
  }

  async getMentorship(id: number): Promise<Mentorship | undefined> {
    const [mentorship] = await db
      .select()
      .from(mentorships)
      .where(eq(mentorships.id, id))
      .limit(1);
    return mentorship || undefined;
  }

  async findMentorship(
    roadmapId: number,
    mentorId: number,
    learnerId: number,
  ): Promise<Mentorship | undefined> {
    const [mentorship] = await db
      .select()
      .from(mentorships)
      .where(
        and(
          eq(mentorships.roadmapId, roadmapId),
          eq(mentorships.mentorId, mentorId),
          eq(mentorships.learnerId, learnerId),
        ),
      )
      .limit(1);
    return mentorship || undefined;
  }

  async getMentorshipsByRoadmap(roadmapId: number): Promise<Mentorship[]> {
    return await db
      .select()
      .from(mentorships)
      .where(eq(mentorships.roadmapId, roadmapId))
      .orderBy(mentorships.id);
  }

  async userCanAccessRoadmap(
    userId: number,
    role: "MENTOR" | "LEARNER",
    roadmapId: number,
  ): Promise<boolean> {
    const roadmap = await this.getRoadmap(roadmapId);
    if (!roadmap) {
      return false;
    }

    const roadmapMemberships = await this.getMentorshipsByRoadmap(roadmapId);
    return hasRoadmapAccess({
      userId,
      role,
      roadmap,
      memberships: roadmapMemberships,
    });
  }
}
