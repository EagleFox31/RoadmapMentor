import cron from "node-cron";
import { storage } from "./storage";
import { emailService } from "./services/emailService";

/**
 * Fonction qui envoie les rappels de tâches aux apprenants
 * Parcourt tous les apprenants et envoie UN email par apprenant s'ils ont des tâches en attente
 * (peu importe le nombre de semaines concernées)
 */
async function sendTaskReminders() {
  console.log(`[Scheduler] Envoi des rappels de tâches - ${new Date().toISOString()}`);
  
  try {
    const learners = await emailService.getAllLearners();
    const weeks = await storage.getAllWeeks();
    
    let sentCount = 0;
    let skippedCount = 0;

    // Pour chaque apprenant, vérifier toutes les tâches en attente
    for (const learner of learners) {
      let totalPendingTasks = 0;
      let weekWithMostPendingTasks = 0;
      let maxPendingInWeek = 0;

      // Parcourir toutes les semaines pour cet apprenant
      for (const week of weeks) {
        const objectives = await storage.getObjectivesByWeek(week.id);
        let pendingTasksInWeek = 0;

        for (const objective of objectives) {
          const tasks = await storage.getTasksByObjective(objective.id);
          for (const task of tasks) {
            const progress = await storage.getTaskProgress(task.id, learner.id);
            if (!progress || !progress.isDone) {
              pendingTasksInWeek++;
              totalPendingTasks++;
            }
          }
        }

        // Garder la trace de la semaine avec le plus de tâches en attente
        if (pendingTasksInWeek > maxPendingInWeek) {
          maxPendingInWeek = pendingTasksInWeek;
          weekWithMostPendingTasks = week.number;
        }
      }

      // Envoyer UN SEUL email si l'apprenant a des tâches en attente
      // L'email mentionne la semaine qui a le plus de tâches en attente
      if (totalPendingTasks > 0) {
        const sent = await emailService.sendTaskReminder(
          learner.id,
          learner.email,
          learner.fullName,
          weekWithMostPendingTasks,
          totalPendingTasks
        );
        
        if (sent) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`[Scheduler] Rappels envoyés: ${sentCount}, Ignorés: ${skippedCount}, Total apprenants: ${learners.length}`);
  } catch (error) {
    console.error("[Scheduler] Erreur lors de l'envoi des rappels:", error);
  }
}

/**
 * Initialise les tâches planifiées
 * - Mercredi à 10h: Rappel de mi-semaine
 * - Vendredi à 10h: Rappel de fin de semaine
 */
export function initializeScheduler() {
  // Rappel de mi-semaine: Mercredi à 10h (heure locale du serveur)
  cron.schedule('0 10 * * 3', async () => {
    console.log('[Scheduler] Déclenchement du rappel de mi-semaine (Mercredi 10h)');
    await sendTaskReminders();
  }, {
    timezone: "Europe/Paris" // Adaptez selon votre fuseau horaire
  });

  // Rappel de fin de semaine: Vendredi à 10h (heure locale du serveur)
  cron.schedule('0 10 * * 5', async () => {
    console.log('[Scheduler] Déclenchement du rappel de fin de semaine (Vendredi 10h)');
    await sendTaskReminders();
  }, {
    timezone: "Europe/Paris" // Adaptez selon votre fuseau horaire
  });

  console.log('[Scheduler] Tâches planifiées initialisées:');
  console.log('  - Mercredi à 10h: Rappel de mi-semaine');
  console.log('  - Vendredi à 10h: Rappel de fin de semaine');
  console.log('  - Fuseau horaire: Europe/Paris');
}
