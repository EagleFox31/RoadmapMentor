import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  deliverables,
  type Deliverable,
  type InsertDeliverable,
} from "@shared/schema";

export interface DeliverableStore {
  getDeliverablesByWeek(weekId: number): Promise<Deliverable[]>;
  getDeliverable(id: number): Promise<Deliverable | undefined>;
  createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: number, deliverable: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(id: number): Promise<boolean>;
}

export class DeliverableRepository implements DeliverableStore {
  // Deliverable methods
  async getDeliverablesByWeek(weekId: number): Promise<Deliverable[]> {
    return await db.select().from(deliverables).where(eq(deliverables.weekId, weekId));
  }

  async getDeliverable(id: number): Promise<Deliverable | undefined> {
    const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, id));
    return deliverable || undefined;
  }

  async createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable> {
    const [created] = await db.insert(deliverables).values(deliverable).returning();
    return created;
  }

  async updateDeliverable(id: number, deliverable: Partial<InsertDeliverable>): Promise<Deliverable | undefined> {
    const [updated] = await db.update(deliverables).set(deliverable).where(eq(deliverables.id, id)).returning();
    return updated || undefined;
  }

  async deleteDeliverable(id: number): Promise<boolean> {
    const result = await db.delete(deliverables).where(eq(deliverables.id, id));
    return true;
  }
}
