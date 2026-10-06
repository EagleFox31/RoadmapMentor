import cron from "node-cron";
import { storage } from "./storage";
import { emailService } from "./services/emailService";
import { claimJobRun, finishJobRun } from "./services/jobRuns";
import { resolveSchedulerConfig } from "./services/schedulerConfig";

/**
 * Fonction qui envoie les rappels de tâches aux apprenants
 * Parcourt tous les apprenants et envoie UN email par apprenant s'ils ont des tâches en attente
 * (peu importe le nombre de semaines concernées)
 */
async function sendTaskReminders(): Promise<string> {
  console.log(`[Scheduler] Envoi des rappels de tâches - ${new Date().toISOString()}`);
  
  try {
    const learners = await emailService.getAllLearners();

    let sentCount = 0;
    let skippedCount = 0;

    // Pour chaque apprenant, vérifier toutes les tâches en attente
    for (const learner of learners) {
      let totalPendingTasks = 0;
      let weekWithMostPendingTasks = 0;
      let maxPendingInWeek = 0;

      const weeks = (
        await storage.getAccessibleWeeks(learner.id, "LEARNER")
      ).filter((week) => week.isValidatedByMentor);

      // Parcourir uniquement les semaines accessibles à cet apprenant
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

    const summary = `Rappels envoyés: ${sentCount}, Ignorés: ${skippedCount}, Total apprenants: ${learners.length}`;
    console.log(`[Scheduler] ${summary}`);
    return summary;
  } catch (error) {
    console.error("[Scheduler] Erreur lors de l'envoi des rappels:", error);
    throw error;
  }
}

/**
 * Initialise les tâches planifiées (horaires, fuseau et activation via SCHEDULER_*).
 * Chaque exécution est réservée en base pour son créneau planifié : avec plusieurs instances
 * ou après un redémarrage, un créneau n'est traité qu'une seule fois.
 */
export function initializeScheduler() {
  const config = resolveSchedulerConfig();
  if (!config.enabled) {
    console.log("[Scheduler] Désactivé (SCHEDULER_ENABLED=false)");
    return;
  }

  for (const job of config.jobs) {
    cron.schedule(
      job.expression,
      async (context) => {
        const runKey = context.date.toISOString();
        const startedAt = Date.now();
        try {
          if (!(await claimJobRun(job.name, runKey))) {
            console.log(`[Scheduler] ${job.name} ${runKey}: déjà pris en charge par une autre instance`);
            return;
          }
        } catch (error) {
          console.error(`[Scheduler] ${job.name} ${runKey}: réservation impossible`, error);
          return;
        }

        console.log(`[Scheduler] ${job.label} (${job.name}) ${runKey}`);
        try {
          const summary = await sendTaskReminders();
          await finishJobRun(job.name, runKey, "SUCCEEDED", summary);
          console.log(`[Scheduler] ${job.name} ${runKey}: terminé en ${Date.now() - startedAt} ms`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await finishJobRun(job.name, runKey, "FAILED", message).catch(() => undefined);
          console.error(`[Scheduler] ${job.name} ${runKey}: échec en ${Date.now() - startedAt} ms`);
        }
      },
      { timezone: config.timezone },
    );
  }

  console.log("[Scheduler] Tâches planifiées initialisées:");
  for (const job of config.jobs) {
    console.log(`  - ${job.label}: ${job.expression}`);
  }
  console.log(`  - Fuseau horaire: ${config.timezone}`);
}
