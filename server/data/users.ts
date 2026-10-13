import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  users,
  type User,
  type InsertUser,
} from "@shared/schema";

export interface UserStore {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByRole(role: "MENTOR" | "LEARNER"): Promise<User[]>;
  updateUser(id: number, data: Partial<Pick<User, "fullName" | "password">>): Promise<User>;
}

export class UserRepository implements UserStore {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsersByRole(role: "MENTOR" | "LEARNER"): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(users.id);
  }

  async updateUser(id: number, data: Partial<Pick<User, "fullName" | "password">>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }
}
