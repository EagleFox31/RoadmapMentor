import { storage } from "../storage";
import { generateToken, hashPassword } from "../auth";
import { emailService } from "./emailService";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
} from "./invitationTokens";
import { ConflictError, GoneError, NotFoundError } from "../domain/errors";
import { acceptInvitationSchema, insertMentorshipSchema, type Mentorship, type User } from "@shared/schema";
import type { InvitationSummary } from "../data/invitations";

/** Returns the existing mentorship (created=false) or creates it (created=true). */
export async function attachLearner(
  roadmapId: number,
  mentorId: number,
  learnerId: number,
): Promise<{ mentorship: Mentorship; created: boolean }> {
  const existing = await storage.findMentorship(roadmapId, mentorId, learnerId);
  if (existing) return { mentorship: existing, created: false };
  const data = insertMentorshipSchema.parse({
    roadmapId,
    mentorId,
    learnerId,
    status: "ACTIVE",
    startedAt: new Date(),
    endedAt: null,
  });
  return { mentorship: await storage.createMentorship(data), created: true };
}

export type InviteOutcome =
  | { outcome: "attached"; mentorship: Mentorship; created: boolean }
  | { outcome: "invited"; invitation: InvitationSummary; emailSent: boolean };

async function deliver(mentor: User, invitation: InvitationSummary, token: string): Promise<boolean> {
  const roadmap = await storage.getRoadmap(invitation.roadmapId);
  return emailService.sendInvitation(
    invitation.email,
    mentor.fullName,
    roadmap?.title ?? "",
    token,
    invitation.expiresAt,
  );
}

/** `email` must already be trimmed and lowercased (createInvitationSchema). */
export async function inviteLearner(mentor: User, roadmapId: number, email: string): Promise<InviteOutcome> {
  const user = (await storage.getUserByEmail(email)) ?? (await storage.getUserByEmail(email.toLowerCase()));
  if (user) {
    if (user.role !== "LEARNER") throw new ConflictError("This email cannot be invited");
    return { outcome: "attached", ...(await attachLearner(roadmapId, mentor.id, user.id)) };
  }
  const { token, tokenHash } = generateInvitationToken();
  const invitation = await storage.createOrRotateInvitation({
    email,
    roadmapId,
    mentorId: mentor.id,
    tokenHash,
    expiresAt: invitationExpiry(),
  });
  return { outcome: "invited", invitation, emailSent: await deliver(mentor, invitation, token) };
}

async function ownedInvitation(mentorId: number, invitationId: number): Promise<InvitationSummary> {
  const invitation = await storage.getInvitation(invitationId);
  if (!invitation || invitation.mentorId !== mentorId) throw new NotFoundError("Invitation not found");
  return invitation;
}

/** Rotates the token: the previously sent link stops working. */
export async function resendInvitation(mentor: User, invitationId: number) {
  const current = await ownedInvitation(mentor.id, invitationId);
  if (current.status !== "PENDING") throw new ConflictError("Invitation is no longer pending");
  const { token, tokenHash } = generateInvitationToken();
  const invitation = await storage.rotateInvitationToken(current.id, tokenHash, invitationExpiry());
  if (!invitation) throw new ConflictError("Invitation is no longer pending");
  return { invitation, emailSent: await deliver(mentor, invitation, token) };
}

export async function revokeInvitation(mentorId: number, invitationId: number) {
  await ownedInvitation(mentorId, invitationId);
  return storage.revokeInvitation(invitationId);
}

export async function listInvitations(mentorId: number, roadmapId: number) {
  const rows = await storage.getInvitationsByRoadmap(roadmapId, mentorId);
  return rows.map((row) => ({ ...row, state: invitationState(row) }));
}

/** Public lookup behind the /invite/:token page. */
export async function describeInvitation(token: string) {
  const invitation = await storage.getInvitationByTokenHash(hashInvitationToken(token));
  if (!invitation) throw new NotFoundError("Invitation not found");
  const state = invitationState(invitation);
  if (state === "ACCEPTED") throw new GoneError("Invitation already used", "USED");
  if (state === "REVOKED") throw new GoneError("Invitation revoked", "REVOKED");
  if (state === "EXPIRED") throw new GoneError("Invitation expired", "EXPIRED");
  const [roadmap, mentor] = await Promise.all([
    storage.getRoadmap(invitation.roadmapId),
    storage.getUser(invitation.mentorId),
  ]);
  return {
    email: invitation.email,
    roadmapId: invitation.roadmapId,
    roadmapTitle: roadmap?.title ?? "",
    mentorName: mentor?.fullName ?? "",
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(token: string, body: unknown) {
  const { fullName, password } = acceptInvitationSchema.parse(body);
  const passwordHash = await hashPassword(password);
  const { user, invitation } = await storage.acceptInvitation(hashInvitationToken(token), {
    fullName,
    passwordHash,
  });
  const { password: _password, ...safeUser } = user;
  return { token: generateToken(user), user: safeUser, roadmapId: invitation.roadmapId };
}
