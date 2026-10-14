import { Resend } from "resend";
import { db } from "../db";
import { emailNotifications, emailNotificationPreferences, users } from "@shared/schema";
import type { InsertEmailNotification } from "@shared/schema";
import { eq } from "drizzle-orm";
import { canLogOtpCodes } from "../security";
import {
  buildAIGenerationFailureEmail,
  buildAIGenerationSuccessEmail,
  buildBadgeUnlockedEmail,
  buildCommentNotificationEmail,
  buildDeadlineApproachingEmail,
  buildInvitationEmail,
  buildMilestoneReachedEmail,
  buildNewTaskAssignedEmail,
  buildOtpEmail,
  buildProgressUpdateEmail,
  buildScreenshotUploadedEmail,
  buildStreakWarningEmail,
  buildTaskReminderEmail,
  buildWeekModifiedEmail,
  buildWeekPreparationEmail,
  buildWeekValidationEmail,
  buildWeeklyReportEmail,
} from "./emailTemplates";

if (!process.env.RESEND_API_KEY) {
  console.warn("[EMAIL WARNING] Missing RESEND_API_KEY. Email sending will fail.");
}

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.MAIL_FROM || "Roadmap Mentor <roadmapmentor@trigenys.com>";
const APP_URL =
  process.env.APP_URL?.replace(/\/$/, "") ||
  (process.env.REPL_SLUG && process.env.REPL_OWNER
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : "http://localhost:5000");

export class EmailService {
  async canSendNotification(userId: number, notificationType: keyof Omit<typeof emailNotificationPreferences.$inferSelect, "id" | "userId" | "createdAt" | "updatedAt">): Promise<boolean> {
    const [prefs] = await db
      .select()
      .from(emailNotificationPreferences)
      .where(eq(emailNotificationPreferences.userId, userId));

    if (!prefs) {
      return true;
    }

    return prefs[notificationType] === true;
  }

  async logEmailNotification(notificationData: InsertEmailNotification): Promise<void> {
    await db.insert(emailNotifications).values(notificationData);
  }

  private async sendAndLog(
    userId: number,
    recipientEmail: string,
    subject: string,
    html: string,
    type: typeof emailNotifications.$inferSelect.type
  ): Promise<boolean> {
    try {
      console.log(`[EMAIL SEND] Sending to ${recipientEmail}: ${subject}`);

      const { data, error } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`[EMAIL SUCCESS] Email sent to ${recipientEmail} - ID: ${data?.id}`);
      await this.logEmailNotification({
        userId,
        type,
        subject,
        recipientEmail,
        status: "sent",
        errorMessage: null,
      });

      return true;
    } catch (error: any) {
      console.error("[EMAIL ERROR] Resend API error:", error);
      await this.logEmailNotification({
        userId,
        type,
        subject,
        recipientEmail,
        status: "failed",
        errorMessage: error.message || "Unknown error",
      });
      return false;
    }
  }

  /**
   * Invitation d'un futur apprenant. Pas de journal `email_notifications` :
   * la table exige un user_id et l'invité n'a pas encore de compte
   * (le suivi passe par send_count / last_sent_at). Le lien n'est jamais journalisé.
   */
  async sendInvitation(
    to: string,
    mentorName: string,
    roadmapTitle: string,
    token: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const { subject, html } = buildInvitationEmail({ appUrl: APP_URL, to, mentorName, roadmapTitle, token, expiresAt });
    try {
      const { error } = await getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } catch (error: any) {
      console.error("[EMAIL ERROR] Invitation not sent:", error?.message ?? "unknown error");
      return false;
    }
  }

  async sendOtp(
    to: string,
    code: string,
    purpose: "REGISTRATION" | "LOGIN",
    userName?: string,
  ): Promise<boolean> {
    const { subject, html } = buildOtpEmail({ appUrl: APP_URL, to, code, purpose, userName });

    const logCodes = canLogOtpCodes();
    if (logCodes) {
      console.log(`[OTP] Sent ${purpose} code to ${to} (${userName ?? "anonyme"}): ${code}`);
    }

    try {
      if (!process.env.RESEND_API_KEY) {
        if (logCodes) {
          console.warn(`[OTP DEV MODE] Missing RESEND_API_KEY. Simulating delivery for ${to}.`);
          return true;
        }
        console.error("[EMAIL ERROR] OTP email not sent: RESEND_API_KEY is not configured.");
        return false;
      }
      const { error } = await getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } catch (error: any) {
      console.error("[EMAIL ERROR] OTP email not sent:", error?.message ?? "unknown error");
      if (logCodes) {
        console.warn("[OTP FALLBACK] Code logging enabled: continuing without delivery.");
        return true;
      }
      return false;
    }
  }

  async sendTaskReminder(userId: number, userEmail: string, userName: string, weekNumber: number, pendingTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "taskReminders");
    if (!canSend) return false;
    const { subject, html } = buildTaskReminderEmail({
      appUrl: APP_URL, to: userEmail, userName, weekNumber, pendingTasksCount,
    });
    return await this.sendAndLog(userId, userEmail, subject, html, "TASK_REMINDER");
  }

  async sendWeekPreparationReminder(userId: number, userEmail: string, userName: string, nextWeekNumber: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "weekPreparation");
    if (!canSend) return false;
    const { subject, html } = buildWeekPreparationEmail({
      appUrl: APP_URL, to: userEmail, userName, nextWeekNumber,
    });
    return await this.sendAndLog(userId, userEmail, subject, html, "WEEK_PREPARATION");
  }

  async sendProgressUpdate(mentorId: number, mentorEmail: string, mentorName: string, learnerName: string, weekNumber: number, completionPercentage: number): Promise<boolean> {
    const canSend = await this.canSendNotification(mentorId, "progressUpdates");
    if (!canSend) return false;
    const { subject, html } = buildProgressUpdateEmail({
      appUrl: APP_URL, to: mentorEmail, mentorName, learnerName, weekNumber, completionPercentage,
    });
    return await this.sendAndLog(mentorId, mentorEmail, subject, html, "PROGRESS_UPDATE");
  }

  async sendCommentNotification(recipientId: number, recipientEmail: string, recipientName: string, commenterName: string, weekNumber: number, commentPreview: string): Promise<boolean> {
    const canSend = await this.canSendNotification(recipientId, "commentNotifications");
    if (!canSend) return false;
    const { subject, html } = buildCommentNotificationEmail({
      appUrl: APP_URL, to: recipientEmail, recipientName, commenterName, weekNumber, commentPreview,
    });
    return await this.sendAndLog(recipientId, recipientEmail, subject, html, "COMMENT_NOTIFICATION");
  }

  async getAllMentors() {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "MENTOR"));
  }

  async getAllLearners() {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "LEARNER"));
  }

  async sendAIGenerationSuccess(userId: number, userEmail: string, userName: string, weeksGenerated: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "aiGenerationNotifications");
    if (!canSend) return false;
    const { subject, html } = buildAIGenerationSuccessEmail({
      appUrl: APP_URL, to: userEmail, userName, weeksGenerated,
    });
    return await this.sendAndLog(userId, userEmail, subject, html, "AI_GENERATION_SUCCESS");
  }

  async sendAIGenerationFailure(userId: number, userEmail: string, userName: string, errorMessage: string): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "aiGenerationNotifications");
    if (!canSend) return false;
    const { subject, html } = buildAIGenerationFailureEmail({
      appUrl: APP_URL, to: userEmail, userName, errorMessage,
    });
    return await this.sendAndLog(userId, userEmail, subject, html, "AI_GENERATION_FAILURE");
  }

  async sendWeekValidation(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, mentorName: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weekValidationNotifications");
    if (!canSend) return false;
    const { subject, html } = buildWeekValidationEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, weekNumber, mentorName,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEK_VALIDATION");
  }

  async sendNewTaskAssigned(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, newTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "newTaskNotifications");
    if (!canSend) return false;
    const { subject, html } = buildNewTaskAssignedEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, weekNumber, newTasksCount,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "NEW_TASK_ASSIGNED");
  }

  async sendScreenshotUploaded(mentorId: number, mentorEmail: string, mentorName: string, learnerName: string, taskTitle: string, weekNumber: number): Promise<boolean> {
    const canSend = await this.canSendNotification(mentorId, "screenshotNotifications");
    if (!canSend) return false;
    const { subject, html } = buildScreenshotUploadedEmail({
      appUrl: APP_URL, to: mentorEmail, mentorName, learnerName, taskTitle, weekNumber,
    });
    return await this.sendAndLog(mentorId, mentorEmail, subject, html, "SCREENSHOT_UPLOADED");
  }

  async sendWeekModified(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, modificationType: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weekModifiedNotifications");
    if (!canSend) return false;
    const { subject, html } = buildWeekModifiedEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, weekNumber, modificationType,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEK_MODIFIED");
  }

  async sendDeadlineApproaching(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, daysRemaining: number, pendingTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "deadlineReminders");
    if (!canSend) return false;
    const { subject, html } = buildDeadlineApproachingEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, weekNumber, daysRemaining, pendingTasksCount,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "DEADLINE_APPROACHING");
  }

  async sendStreakWarning(learnerId: number, learnerEmail: string, learnerName: string, currentStreak: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "streakWarnings");
    if (!canSend) return false;
    const { subject, html } = buildStreakWarningEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, currentStreak,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "STREAK_WARNING");
  }

  async sendMilestoneReached(learnerId: number, learnerEmail: string, learnerName: string, milestonePercentage: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "milestoneNotifications");
    if (!canSend) return false;
    const { subject, html } = buildMilestoneReachedEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, milestonePercentage,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "MILESTONE_REACHED");
  }

  async sendBadgeUnlocked(learnerId: number, learnerEmail: string, learnerName: string, badgeName: string, badgeDescription: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "badgeNotifications");
    if (!canSend) return false;
    const { subject, html } = buildBadgeUnlockedEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, badgeName, badgeDescription,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "BADGE_UNLOCKED");
  }

  async sendWeeklyReport(learnerId: number, learnerEmail: string, learnerName: string, tasksCompleted: number, hoursSpent: number, weeksCompleted: number, streak: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weeklyReports");
    if (!canSend) return false;
    const { subject, html } = buildWeeklyReportEmail({
      appUrl: APP_URL, to: learnerEmail, learnerName, tasksCompleted, hoursSpent, weeksCompleted, streak,
    });
    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEKLY_REPORT");
  }
}

export const emailService = new EmailService();
