import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  resources,
  resourceConsultations,
  type Resource,
  type InsertResource,
} from "@shared/schema";

export interface ResourceStore {
  getResourcesByWeek(weekId: number): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;
  getConsultedResourceIds(weekId: number, learnerId: number): Promise<number[]>;
  setResourceConsulted(resourceId: number, learnerId: number, consulted: boolean): Promise<void>;
  approveResource(id: number): Promise<Resource | undefined>;
  reportUnavailableResource(id: number): Promise<Resource | undefined>;
  clearUnavailableReport(id: number): Promise<Resource | undefined>;
}

export class ResourceRepository implements ResourceStore {
  // Resource methods
  async getResourcesByWeek(weekId: number): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.weekId, weekId));
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    return created;
  }

  async updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined> {
    const existing = await this.getResource(id);
    if (!existing) return undefined;
    const changed = resource.url !== undefined && resource.url !== existing.url;
    const [updated] = await db.update(resources)
      .set(changed ? { ...resource, isApproved: false, unavailableReportedAt: null } : resource)
      .where(eq(resources.id, id)).returning();
    if (changed && updated) {
      // A consultation of the previous URL cannot count as a consultation of
      // this new document. Never carry the old self-report across link changes.
      await db.delete(resourceConsultations).where(eq(resourceConsultations.resourceId, id));
    }
    return updated || undefined;
  }

  async deleteResource(id: number): Promise<boolean> {
    await db.delete(resources).where(eq(resources.id, id));
    return true;
  }
  async getConsultedResourceIds(weekId: number, learnerId: number): Promise<number[]> {
    const rows = await db.select({ id: resourceConsultations.resourceId })
      .from(resourceConsultations)
      .innerJoin(resources, eq(resourceConsultations.resourceId, resources.id))
      .where(and(eq(resources.weekId, weekId), eq(resources.isApproved, true), eq(resourceConsultations.learnerId, learnerId)));
    return rows.map(row => row.id);
  }
  async setResourceConsulted(resourceId: number, learnerId: number, consulted: boolean): Promise<void> {
    if (consulted) {
      await db.insert(resourceConsultations).values({ resourceId, learnerId })
        .onConflictDoNothing({ target: [resourceConsultations.resourceId, resourceConsultations.learnerId] });
    } else {
      await db.delete(resourceConsultations).where(and(
        eq(resourceConsultations.resourceId, resourceId), eq(resourceConsultations.learnerId, learnerId),
      ));
    }
  }
  async approveResource(id: number): Promise<Resource | undefined> {
    const [row] = await db.update(resources).set({ isApproved: true }).where(eq(resources.id, id)).returning();
    return row;
  }
  async reportUnavailableResource(id: number): Promise<Resource | undefined> {
    const [row] = await db.update(resources).set({ unavailableReportedAt: new Date() })
      .where(eq(resources.id, id)).returning();
    return row;
  }
  async clearUnavailableReport(id: number): Promise<Resource | undefined> {
    const [row] = await db.update(resources).set({ unavailableReportedAt: null })
      .where(eq(resources.id, id)).returning();
    return row;
  }
}
