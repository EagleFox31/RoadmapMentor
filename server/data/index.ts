import { UserRepository, type UserStore } from "./users";
import { RoadmapRepository, type RoadmapStore } from "./roadmaps";
import { MentoringPackageRepository, type MentoringPackageStore } from "./mentoringPackages";
import { ChangeRequestRepository, type ChangeRequestStore } from "./changeRequests";
import { MentoringSessionRepository, type MentoringSessionStore } from "./mentoringSessions";
import { BillingRepository, type BillingStore } from "./billing";
import { WeekRepository, type WeekStore } from "./weeks";
import { ObjectiveRepository, type ObjectiveStore } from "./objectives";
import { TaskRepository, type TaskStore } from "./tasks";
import { WeekContentsRepository, type WeekContentsStore } from "./weekContents";
import { DeliverableRepository, type DeliverableStore } from "./deliverables";
import { ResourceRepository, type ResourceStore } from "./resources";
import { LabRepository, type LabStore } from "./labs";
import { ProgressRepository, type ProgressStore } from "./progress";
import { CommentRepository, type CommentStore } from "./comments";
import { EmailPreferencesRepository, type EmailPreferencesStore } from "./emailPreferences";
export type { WeekContents } from "./weekContents";

export type IStorage =
  & UserStore
  & RoadmapStore
  & MentoringPackageStore
  & ChangeRequestStore
  & MentoringSessionStore
  & BillingStore
  & WeekStore
  & ObjectiveStore
  & TaskStore
  & WeekContentsStore
  & DeliverableStore
  & ResourceStore
  & LabStore
  & ProgressStore
  & CommentStore
  & EmailPreferencesStore;

/** Composes the per-aggregate repositories into the single storage facade. */
export function createStorage(): IStorage {
  const target: Record<string, unknown> = {};
  const store = () => target as unknown as IStorage;
  const repositories: object[] = [
    new UserRepository(),
    new RoadmapRepository(),
    new MentoringPackageRepository(),
    new ChangeRequestRepository(),
    new MentoringSessionRepository(),
    new BillingRepository(),
    new WeekRepository(store),
    new ObjectiveRepository(store),
    new TaskRepository(),
    new WeekContentsRepository(),
    new DeliverableRepository(),
    new ResourceRepository(),
    new LabRepository(),
    new ProgressRepository(),
    new CommentRepository(),
    new EmailPreferencesRepository(),
  ];
  for (const repository of repositories) {
    const proto = Object.getPrototypeOf(repository);
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") continue;
      if (name in target) {
        throw new Error("Duplicate storage method: " + name);
      }
      target[name] = proto[name].bind(repository);
    }
  }
  return target as unknown as IStorage;
}
