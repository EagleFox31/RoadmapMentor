import type { ScopeChangeRequest, User } from "@shared/schema";

export type ScopeChangeAction =
  | "QUOTE"
  | "ACCEPT"
  | "REJECT"
  | "LINK_ROADMAP"
  | "DELIVER";

export class InvalidScopeChangeTransitionError extends Error {
  constructor(
    public readonly currentStatus: ScopeChangeRequest["status"],
    public readonly action: ScopeChangeAction,
  ) {
    super(`Cannot ${action.toLowerCase()} a scope change in ${currentStatus} status`);
    this.name = "InvalidScopeChangeTransitionError";
  }
}

export function nextScopeChangeStatus(
  currentStatus: ScopeChangeRequest["status"],
  action: ScopeChangeAction,
  actorRole: User["role"],
): ScopeChangeRequest["status"] {
  if (
    action === "QUOTE" &&
    actorRole === "MENTOR" &&
    (currentStatus === "PROPOSED" || currentStatus === "QUOTED")
  ) {
    return "QUOTED";
  }

  if (
    action === "ACCEPT" &&
    actorRole === "LEARNER" &&
    currentStatus === "QUOTED"
  ) {
    return "ACCEPTED";
  }

  if (
    action === "REJECT" &&
    actorRole === "LEARNER" &&
    currentStatus === "QUOTED"
  ) {
    return "REJECTED";
  }

  if (
    action === "LINK_ROADMAP" &&
    actorRole === "MENTOR" &&
    currentStatus === "ACCEPTED"
  ) {
    return "ACCEPTED";
  }

  if (
    action === "DELIVER" &&
    actorRole === "MENTOR" &&
    currentStatus === "ACCEPTED"
  ) {
    return "DELIVERED";
  }

  throw new InvalidScopeChangeTransitionError(currentStatus, action);
}
