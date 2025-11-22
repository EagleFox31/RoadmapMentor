import { storage } from "../storage";
import { emailService } from "../services/emailService";

/**
 * Envoi de rappels pour les tâches non complétées
 * À exécuter quotidiennement (par exemple chaque lundi à 9h)
 */
export async function sendTaskReminders() {
  console.log("[EmailJob] Envoi des rappels de tâches...");
  
  try {
    const learners = await emailService.getAllLearners();
    const weeks = await storage.getAllWeeks();
    
    for (const learner of learners) {
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
export async function sendWeekPreparationReminders() {
  console.log("[EmailJob] Envoi des rappels de préparation de semaine...");
  
  try {
    const mentors = await emailService.getAllMentors();
    const weeks = await storage.getAllWeeks();
    
    // Trouver le numéro de la prochaine semaine à créer
    const maxWeekNumber = weeks.reduce((max, week) => Math.max(max, week.number), 0);
    const nextWeekNumber = maxWeekNumber + 1;
    
    for (const mentor of mentors) {
      await emailService.sendWeekPreparationReminder(
        mentor.id,
        mentor.email,
        mentor.fullName,
        nextWeekNumber
      );
      
      console.log(`[EmailJob] Rappel de préparation envoyé à ${mentor.email} pour la semaine ${nextWeekNumber}`);
    }
    
    console.log("[EmailJob] Rappels de préparation envoyés avec succès");
  } catch (error) {
    console.error("[EmailJob] Erreur lors de l'envoi des rappels de préparation:", error);
  }
}

/**
 * Fonction principale pour tester manuellement les envois d'emails
 * Peut être appelée via une route API pour les tests
 */
export async function testEmailNotifications() {
  console.log("[EmailJob] Test des notifications email...");
  
  // Tester les rappels de tâches
  await sendTaskReminders();
  
  // Tester les rappels de préparation
  await sendWeekPreparationReminders();
  
  console.log("[EmailJob] Test des notifications terminé");
}
