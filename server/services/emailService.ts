import { Resend } from "resend";
import { db } from "../db";
import { emailNotifications, emailNotificationPreferences, users } from "@shared/schema";
import type { InsertEmailNotification } from "@shared/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration de l'expéditeur (doit être un domaine vérifié sur Resend)
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "Roadmap Mentor";
const APP_URL = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
  : "http://localhost:5000";

interface EmailTemplateData {
  userName: string;
  [key: string]: any;
}

export class EmailService {
  /**
   * Vérifier si un utilisateur a activé un type de notification
   */
  async canSendNotification(userId: number, notificationType: keyof Omit<typeof emailNotificationPreferences.$inferSelect, "id" | "userId" | "createdAt" | "updatedAt">): Promise<boolean> {
    const [prefs] = await db
      .select()
      .from(emailNotificationPreferences)
      .where(eq(emailNotificationPreferences.userId, userId));

    if (!prefs) {
      // Par défaut, tout est activé
      return true;
    }

    return prefs[notificationType] === true;
  }

  /**
   * Enregistrer l'envoi d'un email dans la base de données
   */
  async logEmailNotification(notificationData: InsertEmailNotification): Promise<void> {
    await db.insert(emailNotifications).values(notificationData);
  }

  /**
   * Envoyer un email et l'enregistrer
   */
  private async sendAndLog(
    userId: number,
    recipientEmail: string,
    subject: string,
    html: string,
    type: typeof emailNotifications.$inferSelect.type
  ): Promise<boolean> {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject,
        html,
      });

      if (error) {
        console.error("Resend error:", error);
        await this.logEmailNotification({
          userId,
          type,
          subject,
          recipientEmail,
          status: "failed",
          errorMessage: error.message,
        });
        return false;
      }

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
      console.error("Email sending error:", error);
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
   * Template: Rappel de travailler sur les tâches
   */
  async sendTaskReminder(userId: number, userEmail: string, userName: string, weekNumber: number, pendingTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "taskReminders");
    if (!canSend) return false;

    const subject = `${APP_NAME} - Rappel: Semaine ${weekNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${userName} 👋</h2>
              <p>Vous avez <strong>${pendingTasksCount} tâche${pendingTasksCount > 1 ? 's' : ''}</strong> en attente pour la semaine ${weekNumber}.</p>
              <p>N'oubliez pas de travailler sur votre roadmap Python pour progresser dans votre apprentissage !</p>
              <a href="${APP_URL}" class="button">Voir mes tâches</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(userId, userEmail, subject, html, "TASK_REMINDER");
  }

  /**
   * Template: Rappel au mentor de préparer la semaine à venir
   */
  async sendWeekPreparationReminder(userId: number, userEmail: string, userName: string, nextWeekNumber: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "weekPreparation");
    if (!canSend) return false;

    const subject = `${APP_NAME} - Préparez la semaine ${nextWeekNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${userName} 👋</h2>
              <p>C'est le moment de préparer la <strong>semaine ${nextWeekNumber}</strong> pour vos apprenants !</p>
              <p>Créez les objectifs, tâches, ressources et livrables pour aider vos apprenants à progresser.</p>
              <a href="${APP_URL}" class="button">Préparer la semaine</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes mentor sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(userId, userEmail, subject, html, "WEEK_PREPARATION");
  }

  /**
   * Template: Notification de progression d'un apprenant
   */
  async sendProgressUpdate(mentorId: number, mentorEmail: string, mentorName: string, learnerName: string, weekNumber: number, completionPercentage: number): Promise<boolean> {
    const canSend = await this.canSendNotification(mentorId, "progressUpdates");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ${learnerName} a progressé (${completionPercentage}%)`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .progress-bar { background: #e5e7eb; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden; }
            .progress-fill { background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); height: 100%; }
            .button { background: #4facfe; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${mentorName} 👋</h2>
              <p><strong>${learnerName}</strong> a progressé dans la semaine ${weekNumber} !</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionPercentage}%"></div>
              </div>
              <p style="text-align: center; font-size: 24px; font-weight: bold; color: #4facfe;">${completionPercentage}% complété</p>
              <a href="${APP_URL}" class="button">Voir la progression</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes mentor sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(mentorId, mentorEmail, subject, html, "PROGRESS_UPDATE");
  }

  /**
   * Template: Notification de nouveau commentaire
   */
  async sendCommentNotification(recipientId: number, recipientEmail: string, recipientName: string, commenterName: string, weekNumber: number, commentPreview: string): Promise<boolean> {
    const canSend = await this.canSendNotification(recipientId, "commentNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - Nouveau commentaire de ${commenterName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .comment-box { background: white; border-left: 4px solid #fa709a; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { background: #fa709a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${recipientName} 👋</h2>
              <p><strong>${commenterName}</strong> a laissé un commentaire sur la semaine ${weekNumber} :</p>
              <div class="comment-box">
                <p>${commentPreview.substring(0, 200)}${commentPreview.length > 200 ? '...' : ''}</p>
              </div>
              <a href="${APP_URL}" class="button">Voir le commentaire</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(recipientId, recipientEmail, subject, html, "COMMENT_NOTIFICATION");
  }

  /**
   * Obtenir tous les mentors
   */
  async getAllMentors() {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "MENTOR"));
  }

  /**
   * Obtenir tous les apprenants
   */
  async getAllLearners() {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "LEARNER"));
  }
}

export const emailService = new EmailService();
