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

// Email autorisé en mode test (Resend ne peut envoyer qu'à cette adresse sans domaine vérifié)
const ALLOWED_TEST_EMAIL = "justsmilewithme242@gmail.com";

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
      // En mode test (sans domaine vérifié), Resend ne peut envoyer qu'à l'email autorisé
      if (recipientEmail !== ALLOWED_TEST_EMAIL) {
        console.log(`[EMAIL SKIP] Cannot send to ${recipientEmail} in test mode (only ${ALLOWED_TEST_EMAIL} allowed)`);
        await this.logEmailNotification({
          userId,
          type,
          subject,
          recipientEmail,
          status: "skipped",
          errorMessage: `Test mode: can only send to ${ALLOWED_TEST_EMAIL}`,
        });
        return false;
      }

      console.log(`[EMAIL SEND] Sending to ${recipientEmail}: ${subject}`);
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject,
        html,
      });

      if (error) {
        console.error("[EMAIL ERROR] Resend error:", error);
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

      console.log(`[EMAIL SUCCESS] Email sent to ${recipientEmail} with ID: ${data?.id}`);
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

  // ============================================================================
  // AI/SYSTEM NOTIFICATIONS
  // ============================================================================

  /**
   * Template: Succès génération IA de roadmap
   */
  async sendAIGenerationSuccess(userId: number, userEmail: string, userName: string, weeksGenerated: number): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "aiGenerationNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ✨ Roadmap générée avec succès !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 64px; text-align: center; margin: 20px 0; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <div class="success-icon">🎉</div>
              <h2>Bonjour ${userName} 👋</h2>
              <p>Excellente nouvelle ! Votre roadmap de <strong>${weeksGenerated} semaine${weeksGenerated > 1 ? 's' : ''}</strong> a été générée avec succès par l'IA.</p>
              <p>Vous pouvez maintenant consulter les objectifs, tâches et ressources créés automatiquement pour votre apprentissage.</p>
              <a href="${APP_URL}" class="button">Voir ma roadmap</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(userId, userEmail, subject, html, "AI_GENERATION_SUCCESS");
  }

  /**
   * Template: Échec génération IA de roadmap
   */
  async sendAIGenerationFailure(userId: number, userEmail: string, userName: string, errorMessage: string): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, "aiGenerationNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ⚠️ Erreur de génération de roadmap`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .error-box { background: #fef2f2; border-left: 4px solid #f5576c; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${userName} 👋</h2>
              <p>Nous avons rencontré un problème lors de la génération de votre roadmap.</p>
              <div class="error-box">
                <p><strong>Erreur :</strong> ${errorMessage}</p>
              </div>
              <p>Veuillez réessayer dans quelques instants. Si le problème persiste, contactez le support.</p>
              <a href="${APP_URL}" class="button">Réessayer</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(userId, userEmail, subject, html, "AI_GENERATION_FAILURE");
  }

  /**
   * Template: Validation d'une semaine par le mentor
   */
  async sendWeekValidation(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, mentorName: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weekValidationNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ✅ Semaine ${weekNumber} validée !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .button { background: #4facfe; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <div class="badge">✨ VALIDÉE</div>
              <p>Félicitations ! Votre mentor <strong>${mentorName}</strong> a validé la <strong>semaine ${weekNumber}</strong>.</p>
              <p>Vous pouvez maintenant passer à la semaine suivante !</p>
              <a href="${APP_URL}" class="button">Continuer ma progression</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEK_VALIDATION");
  }

  // ============================================================================
  // COLLABORATION NOTIFICATIONS
  // ============================================================================

  /**
   * Template: Nouvelle tâche assignée
   */
  async sendNewTaskAssigned(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, newTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "newTaskNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - 📝 ${newTasksCount} nouvelle${newTasksCount > 1 ? 's' : ''} tâche${newTasksCount > 1 ? 's' : ''} !`;
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
              <h1>📝 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <p>Votre mentor a ajouté <strong>${newTasksCount} nouvelle${newTasksCount > 1 ? 's' : ''} tâche${newTasksCount > 1 ? 's' : ''}</strong> à la semaine ${weekNumber}.</p>
              <p>Consultez votre roadmap pour découvrir ces nouvelles tâches et continuer votre apprentissage !</p>
              <a href="${APP_URL}" class="button">Voir les nouvelles tâches</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "NEW_TASK_ASSIGNED");
  }

  /**
   * Template: Screenshot uploadé par un apprenant
   */
  async sendScreenshotUploaded(mentorId: number, mentorEmail: string, mentorName: string, learnerName: string, taskTitle: string, weekNumber: number): Promise<boolean> {
    const canSend = await this.canSendNotification(mentorId, "screenshotNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - 🖼️ ${learnerName} a uploadé un screenshot`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .task-box { background: white; border-left: 4px solid #f093fb; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🖼️ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${mentorName} 👋</h2>
              <p><strong>${learnerName}</strong> a uploadé une capture d'écran pour une tâche de la semaine ${weekNumber}.</p>
              <div class="task-box">
                <p><strong>Tâche :</strong> ${taskTitle}</p>
              </div>
              <p>Consultez la soumission pour valider le travail de votre apprenant.</p>
              <a href="${APP_URL}" class="button">Voir le screenshot</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes mentor sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(mentorId, mentorEmail, subject, html, "SCREENSHOT_UPLOADED");
  }

  /**
   * Template: Modification importante d'une semaine
   */
  async sendWeekModified(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, modificationType: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weekModifiedNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ✏️ Semaine ${weekNumber} modifiée`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #fa709a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✏️ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <p>Votre mentor a apporté des modifications à la <strong>semaine ${weekNumber}</strong>.</p>
              <p><strong>Type de modification :</strong> ${modificationType}</p>
              <p>Consultez la roadmap pour voir les changements et adapter votre planning.</p>
              <a href="${APP_URL}" class="button">Voir les modifications</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEK_MODIFIED");
  }

  // ============================================================================
  // INTELLIGENT REMINDERS
  // ============================================================================

  /**
   * Template: Deadline proche (2 jours restants)
   */
  async sendDeadlineApproaching(learnerId: number, learnerEmail: string, learnerName: string, weekNumber: number, daysRemaining: number, pendingTasksCount: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "deadlineReminders");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ⏰ Plus que ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} pour la semaine ${weekNumber} !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <div class="warning-box">
                <p>⚠️ <strong>Attention :</strong> Il ne reste que ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} pour terminer la semaine ${weekNumber} !</p>
              </div>
              <p>Vous avez encore <strong>${pendingTasksCount} tâche${pendingTasksCount > 1 ? 's' : ''}</strong> à compléter.</p>
              <p>C'est le moment de terminer votre roadmap pour rester sur la bonne voie !</p>
              <a href="${APP_URL}" class="button">Terminer mes tâches</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "DEADLINE_APPROACHING");
  }

  /**
   * Template: Streak en danger (pas d'activité aujourd'hui)
   */
  async sendStreakWarning(learnerId: number, learnerEmail: string, learnerName: string, currentStreak: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "streakWarnings");
    if (!canSend) return false;

    const subject = `${APP_NAME} - 🔥 Ne perdez pas votre série de ${currentStreak} jour${currentStreak > 1 ? 's' : ''} !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .streak-box { text-align: center; margin: 20px 0; }
            .streak-number { font-size: 48px; font-weight: bold; color: #f5576c; }
            .button { background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔥 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <p>Vous n'avez pas encore travaillé sur votre roadmap aujourd'hui !</p>
              <div class="streak-box">
                <div class="streak-number">🔥 ${currentStreak}</div>
                <p>jour${currentStreak > 1 ? 's' : ''} de série en cours</p>
              </div>
              <p>Ne perdez pas votre progression ! Complétez au moins une tâche aujourd'hui pour maintenir votre série.</p>
              <a href="${APP_URL}" class="button">Continuer ma série</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "STREAK_WARNING");
  }

  // ============================================================================
  // GAMIFICATION NOTIFICATIONS
  // ============================================================================

  /**
   * Template: Milestone atteint (25%, 50%, 75%, 100%)
   */
  async sendMilestoneReached(learnerId: number, learnerEmail: string, learnerName: string, milestonePercentage: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "milestoneNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - 🏆 Félicitations ! ${milestonePercentage}% de votre roadmap complétée !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .milestone-icon { font-size: 80px; text-align: center; margin: 20px 0; }
            .percentage { font-size: 48px; font-weight: bold; color: #4facfe; text-align: center; }
            .button { background: #4facfe; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏆 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <div class="milestone-icon">${milestonePercentage === 100 ? '🎉' : '🏆'}</div>
              <h2>Félicitations ${learnerName} ! 👏</h2>
              <div class="percentage">${milestonePercentage}%</div>
              <p style="text-align: center; font-size: 18px; margin: 20px 0;">
                ${milestonePercentage === 100 
                  ? 'Vous avez terminé votre roadmap complète ! Incroyable travail !' 
                  : `Vous avez franchi le cap des ${milestonePercentage}% de votre roadmap !`}
              </p>
              <p>Continuez comme ça, vous êtes sur la bonne voie pour devenir un expert Backend Python !</p>
              <a href="${APP_URL}" class="button">Voir ma progression</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "MILESTONE_REACHED");
  }

  /**
   * Template: Badge débloqué
   */
  async sendBadgeUnlocked(learnerId: number, learnerEmail: string, learnerName: string, badgeName: string, badgeDescription: string): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "badgeNotifications");
    if (!canSend) return false;

    const subject = `${APP_NAME} - ⭐ Nouveau badge débloqué : ${badgeName} !`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .badge-box { background: white; border: 3px solid #667eea; border-radius: 15px; padding: 30px; margin: 20px 0; text-align: center; }
            .badge-icon { font-size: 80px; margin-bottom: 10px; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⭐ ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bravo ${learnerName} ! 🎊</h2>
              <p>Vous venez de débloquer un nouveau badge !</p>
              <div class="badge-box">
                <div class="badge-icon">🏅</div>
                <h3 style="color: #667eea; margin: 10px 0;">${badgeName}</h3>
                <p style="color: #666;">${badgeDescription}</p>
              </div>
              <p>Continuez à progresser pour débloquer encore plus de badges !</p>
              <a href="${APP_URL}" class="button">Voir mes badges</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "BADGE_UNLOCKED");
  }

  /**
   * Template: Rapport hebdomadaire personnalisé
   */
  async sendWeeklyReport(learnerId: number, learnerEmail: string, learnerName: string, tasksCompleted: number, hoursSpent: number, weeksCompleted: number, streak: number): Promise<boolean> {
    const canSend = await this.canSendNotification(learnerId, "weeklyReports");
    if (!canSend) return false;

    const subject = `${APP_NAME} - 📊 Votre rapport hebdomadaire`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .stat-box { background: white; border-radius: 10px; padding: 20px; text-align: center; }
            .stat-number { font-size: 36px; font-weight: bold; color: #fa709a; }
            .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
            .button { background: #fa709a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 ${APP_NAME}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${learnerName} 👋</h2>
              <p>Voici votre rapport hebdomadaire de progression :</p>
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-number">✅ ${tasksCompleted}</div>
                  <div class="stat-label">Tâches complétées</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">🔥 ${streak}</div>
                  <div class="stat-label">Jours de série</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">📚 ${weeksCompleted}</div>
                  <div class="stat-label">Semaines terminées</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number">⏱️ ${hoursSpent}h</div>
                  <div class="stat-label">Temps de travail</div>
                </div>
              </div>
              <p>Excellente semaine ! Continuez comme ça pour atteindre vos objectifs d'apprentissage.</p>
              <a href="${APP_URL}" class="button">Voir ma roadmap</a>
            </div>
            <div class="footer">
              <p>Vous recevez cet email car vous êtes inscrit sur ${APP_NAME}</p>
              <p><a href="${APP_URL}/preferences">Gérer mes préférences de notification</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.sendAndLog(learnerId, learnerEmail, subject, html, "WEEKLY_REPORT");
  }
}

export const emailService = new EmailService();
