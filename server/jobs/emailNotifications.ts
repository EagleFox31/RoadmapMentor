import { storage } from "../storage";
import { emailService } from "../services/emailService";
import {
  DEADLINE_REMINDER_DAYS,
  daysUntilEndDate,
} from "../services/weekDeadlines";

/**
 * Envoi de rappels pour les tâches non complétées
 * À exécuter quotidiennement (par exemple chaque lundi à 9h)
 */
export async function sendTaskReminders() {
  console.log("[EmailJob] Envoi des rappels de tâches...");
  
  try {
    const learners = await emailService.getAllLearners();

    for (const learner of learners) {
      const weeks = (
        await storage.getAccessibleWeeks(learner.id, "LEARNER")
      ).filter((week) => week.isValidatedByMentor);

      for (const week of weeks) {
        // Calculer le nombre de tâches en attente pour cette semaine
        const objectives = await storage.getObjectivesByWeek(week.id);
        let pendingTasksCount = 0;
        
        for (const objective of objectives) {
          const tasks = await storage.getTasksByObjective(objective.id);
          for (const task of tasks) {
            const progress = await storage.getTaskProgress(task.id, learner.id);
            if (!progress || !progress.isDone) {
              pendingTasksCount++;
            }
          }
        }
        
        // Si l'apprenant a des tâches en attente, envoyer le rappel
        if (pendingTasksCount > 0) {
          await emailService.sendTaskReminder(
            learner.id,
            learner.email,
            learner.fullName,
            week.number,
            pendingTasksCount
          );
          
          console.log(`[EmailJob] Rappel envoyé à ${learner.email} pour la semaine ${week.number} (${pendingTasksCount} tâches)`);
        }
      }
    }
    
    console.log("[EmailJob] Rappels de tâches envoyés avec succès");
  } catch (error) {
    console.error("[EmailJob] Erreur lors de l'envoi des rappels:", error);
  }
}

/**
 * Envoi de rappels aux mentors pour préparer la semaine suivante
 * À exécuter chaque vendredi à 17h
 */
export async function sendWeekPreparationReminders(): Promise<string> {
  console.log("[EmailJob] Envoi des rappels de préparation de semaine...");
  
  try {
    const mentors = await emailService.getAllMentors();

    for (const mentor of mentors) {
      const weeks = await storage.getAccessibleWeeks(mentor.id, "MENTOR");
      const maxWeekNumber = weeks.reduce(
        (max, week) => Math.max(max, week.number),
        0,
      );
      const nextWeekNumber = maxWeekNumber + 1;

      await emailService.sendWeekPreparationReminder(
        mentor.id,
        mentor.email,
        mentor.fullName,
        nextWeekNumber
      );
      
      console.log(`[EmailJob] Rappel de préparation envoyé à ${mentor.email} pour la semaine ${nextWeekNumber}`);
    }
    
    console.log("[EmailJob] Rappels de préparation envoyés avec succès");
    return `Rappels préparation: ${mentors.length} mentor(s)`;
  } catch (error) {
    console.error("[EmailJob] Erreur lors de l'envoi des rappels de préparation:", error);
    throw error;
  }
}

/**
 * Rappel J-2 avant la date de fin de semaine, si des tâches restent ouvertes.
 */
export async function sendDeadlineReminders(
  timeZone = "Europe/Paris",
): Promise<string> {
  console.log("[EmailJob] Envoi des rappels de deadline...");
  const learners = await emailService.getAllLearners();
  let sentCount = 0;
  let skippedCount = 0;

  for (const learner of learners) {
    const weeks = (
      await storage.getAccessibleWeeks(learner.id, "LEARNER")
    ).filter((week) => week.isValidatedByMentor);

    for (const week of weeks) {
      if (daysUntilEndDate(week.endDate, new Date(), timeZone) !== DEADLINE_REMINDER_DAYS) {
        continue;
      }

      let pendingTasksCount = 0;
      const objectives = await storage.getObjectivesByWeek(week.id);
      for (const objective of objectives) {
        const tasks = await storage.getTasksByObjective(objective.id);
        for (const task of tasks) {
          const progress = await storage.getTaskProgress(task.id, learner.id);
          if (!progress || !progress.isDone) {
            pendingTasksCount++;
          }
        }
      }

      if (pendingTasksCount === 0) {
        continue;
      }

      const sent = await emailService.sendDeadlineApproaching(
        learner.id,
        learner.email,
        learner.fullName,
        week.number,
        DEADLINE_REMINDER_DAYS,
        pendingTasksCount,
      );
      if (sent) {
        sentCount++;
      } else {
        skippedCount++;
      }
    }
  }

  const summary = `Deadlines envoyées: ${sentCount}, Ignorées: ${skippedCount}`;
  console.log(`[EmailJob] ${summary}`);
  return summary;
}

/**
 * Fonction principale pour tester manuellement les envois d'emails
 * Peut être appelée via une route API pour les tests
 */
export async function testEmailNotifications() {
  console.log("[EmailJob] Test des notifications email...");
  
  await sendTaskReminders();
  await sendWeekPreparationReminders();
  await sendDeadlineReminders();

  console.log("[EmailJob] Test des notifications terminé");
}
