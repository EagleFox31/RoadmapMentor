import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  resources,
  type Resource,
  type InsertResource,
} from "@shared/schema";

export interface ResourceStore {
  getResourcesByWeek(weekId: number): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;
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
    const [updated] = await db.update(resources).set(resource).where(eq(resources.id, id)).returning();
    return updated || undefined;
  }

  async deleteResource(id: number): Promise<boolean> {
    const result = await db.delete(resources).where(eq(resources.id, id));
    return true;
  }
}
