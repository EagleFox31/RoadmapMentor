import { createHash, randomBytes } from "crypto";
import type { Invitation } from "@shared/schema";

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_TTL_HOURS = 72;

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** INVITATION_TTL_HOURS (positive integer), 72 h by default. */
export function invitationExpiry(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): Date {
  const hours = Number(env.INVITATION_TTL_HOURS);
  const ttl = Number.isInteger(hours) && hours > 0 ? hours : DEFAULT_TTL_HOURS;
  return new Date(now.getTime() + ttl * HOUR_MS);
}

export type InvitationState = "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";

export function invitationState(
  invitation: Pick<Invitation, "status" | "expiresAt">,
  now: Date = new Date(),
): InvitationState {
  if (invitation.status !== "PENDING") return invitation.status;
  return invitation.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "PENDING";
}
