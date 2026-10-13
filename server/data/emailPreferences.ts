import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import {
  emailNotificationPreferences,
  emailNotifications,
  type EmailNotificationPreferences,
  type InsertEmailNotificationPreferences,
} from "@shared/schema";

/** Notification history entry exposed to its recipient (delivery errors stay server-side). */
export type EmailNotificationEntry = Omit<typeof emailNotifications.$inferSelect, "errorMessage">;

export interface EmailPreferencesStore {
  listEmailNotifications(userId: number, limit: number): Promise<EmailNotificationEntry[]>;
  getEmailPreferences(userId: number): Promise<EmailNotificationPreferences | undefined>;
  updateEmailPreferences(userId: number, preferences: Partial<InsertEmailNotificationPreferences>): Promise<EmailNotificationPreferences>;
  createEmailPreferences(preferences: InsertEmailNotificationPreferences): Promise<EmailNotificationPreferences>;
}

export class EmailPreferencesRepository implements EmailPreferencesStore {
  async listEmailNotifications(userId: number, limit: number): Promise<EmailNotificationEntry[]> {
    return await db
      .select({
        id: emailNotifications.id,
        userId: emailNotifications.userId,
        type: emailNotifications.type,
        subject: emailNotifications.subject,
        recipientEmail: emailNotifications.recipientEmail,
        sentAt: emailNotifications.sentAt,
        status: emailNotifications.status,
      })
      .from(emailNotifications)
      .where(eq(emailNotifications.userId, userId))
      .orderBy(desc(emailNotifications.sentAt))
      .limit(limit);
  }

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
