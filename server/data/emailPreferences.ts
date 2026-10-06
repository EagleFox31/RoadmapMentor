import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  emailNotificationPreferences,
  type EmailNotificationPreferences,
  type InsertEmailNotificationPreferences,
} from "@shared/schema";

export interface EmailPreferencesStore {
  getEmailPreferences(userId: number): Promise<EmailNotificationPreferences | undefined>;
  updateEmailPreferences(userId: number, preferences: Partial<InsertEmailNotificationPreferences>): Promise<EmailNotificationPreferences>;
  createEmailPreferences(preferences: InsertEmailNotificationPreferences): Promise<EmailNotificationPreferences>;
}

export class EmailPreferencesRepository implements EmailPreferencesStore {
  // Email Notification Preferences methods
  async getEmailPreferences(userId: number): Promise<EmailNotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(emailNotificationPreferences)
      .where(eq(emailNotificationPreferences.userId, userId));
    return prefs || undefined;
  }

  async updateEmailPreferences(userId: number, preferences: Partial<InsertEmailNotificationPreferences>): Promise<EmailNotificationPreferences> {
    const [updated] = await db
      .update(emailNotificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(emailNotificationPreferences.userId, userId))
      .returning();
    
    if (!updated) {
      // Si les préférences n'existent pas, les créer
      return await this.createEmailPreferences({ userId, ...preferences } as InsertEmailNotificationPreferences);
    }
    
    return updated;
  }

  async createEmailPreferences(preferences: InsertEmailNotificationPreferences): Promise<EmailNotificationPreferences> {
    const [created] = await db
      .insert(emailNotificationPreferences)
      .values(preferences)
      .returning();
    return created;
  }
}
