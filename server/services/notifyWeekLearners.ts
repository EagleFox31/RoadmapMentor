import type { User, Week } from "@shared/schema";
import { storage } from "../storage";
import { getLearnerIdsForWeek } from "../access/weekAccess";

/** Apprenants rattachés à la roadmap de la semaine. Semaine hors roadmap : personne. */
export async function listWeekLearners(week: Week): Promise<User[]> {
  const ids = await getLearnerIdsForWeek(week);
  if (!ids || ids.size === 0) {
    return [];
  }

  const learners: User[] = [];
  for (const id of Array.from(ids)) {
    const user = await storage.getUser(id);
    if (user?.role === "LEARNER") {
      learners.push(user);
    }
  }
  return learners;
}

export async function notifyWeekLearners(
  week: Week,
  send: (learner: User) => Promise<unknown>,
): Promise<void> {
  const learners = await listWeekLearners(week);
  for (const learner of learners) {
    try {
      await send(learner);
    } catch (error) {
      console.error(
        `[EMAIL] Failed to notify learner ${learner.id} for week ${week.id}:`,
        error,
      );
    }
  }
}
