import { db } from "../db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  invitations,
  users,
  mentorships,
  emailNotificationPreferences,
  type Invitation,
  type User,
  type Mentorship,
} from "@shared/schema";
import { ConflictError, GoneError, NotFoundError } from "../domain/errors";
import { invitationState } from "../services/invitationTokens";

/** An invitation as exposed outside the data layer: never carries the token hash. */
export type InvitationSummary = Omit<Invitation, "tokenHash">;

function toSummary(row: Invitation): InvitationSummary {
  const { tokenHash: _hash, ...rest } = row;
  return rest;
}

export interface InvitationStore {
  /** Idempotent per (roadmap, mentor, email) while PENDING: a repeat rotates the token. */
  createOrRotateInvitation(data: {
    email: string;
    roadmapId: number;
    mentorId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<InvitationSummary>;
  getInvitation(id: number): Promise<InvitationSummary | undefined>;
  getInvitationByTokenHash(tokenHash: string): Promise<InvitationSummary | undefined>;
  getInvitationsByRoadmap(roadmapId: number, mentorId: number): Promise<InvitationSummary[]>;
  rotateInvitationToken(id: number, tokenHash: string, expiresAt: Date): Promise<InvitationSummary | undefined>;
  revokeInvitation(id: number): Promise<InvitationSummary>;
  acceptInvitation(
    tokenHash: string,
    data: { fullName: string; passwordHash: string },
  ): Promise<{ user: User; mentorship: Mentorship; invitation: InvitationSummary }>;
}

export class InvitationRepository implements InvitationStore {
  async createOrRotateInvitation(data: {
    email: string;
    roadmapId: number;
    mentorId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<InvitationSummary> {
    const [row] = await db
      .insert(invitations)
      .values(data)
      .onConflictDoUpdate({
        target: [invitations.roadmapId, invitations.mentorId, invitations.email],
        targetWhere: sql`status = 'PENDING'`,
        set: {
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          sendCount: sql`${invitations.sendCount} + 1`,
          lastSentAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return toSummary(row);
  }

  async getInvitation(id: number): Promise<InvitationSummary | undefined> {
    const [row] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    return row ? toSummary(row) : undefined;
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<InvitationSummary | undefined> {
    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);
    return row ? toSummary(row) : undefined;
  }

  async getInvitationsByRoadmap(roadmapId: number, mentorId: number): Promise<InvitationSummary[]> {
    const rows = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.roadmapId, roadmapId), eq(invitations.mentorId, mentorId)))
      .orderBy(desc(invitations.createdAt), desc(invitations.id));
    return rows.map(toSummary);
  }

  async rotateInvitationToken(
    id: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<InvitationSummary | undefined> {
    const [row] = await db
      .update(invitations)
      .set({
        tokenHash,
        expiresAt,
        sendCount: sql`${invitations.sendCount} + 1`,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(invitations.id, id), eq(invitations.status, "PENDING")))
      .returning();
    return row ? toSummary(row) : undefined;
  }

  async revokeInvitation(id: number): Promise<InvitationSummary> {
    const [current] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    if (!current) throw new NotFoundError("Invitation not found");
    if (current.status === "ACCEPTED") throw new ConflictError("Invitation already accepted");
    if (current.status === "REVOKED") return toSummary(current);
    const [row] = await db
      .update(invitations)
      .set({ status: "REVOKED", revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invitations.id, id), eq(invitations.status, "PENDING")))
      .returning();
    if (!row) throw new ConflictError("Invitation already accepted");
    return toSummary(row);
  }

  /** Account, preferences, mentorship and token consumption commit or fail together. */
  async acceptInvitation(
    tokenHash: string,
    data: { fullName: string; passwordHash: string },
  ): Promise<{ user: User; mentorship: Mentorship; invitation: InvitationSummary }> {
    try {
      return await db.transaction(async (tx) => {
        const [invitation] = await tx
          .select()
          .from(invitations)
          .where(eq(invitations.tokenHash, tokenHash))
          .for("update")
          .limit(1);
        if (!invitation) throw new NotFoundError("Invitation not found");
        const state = invitationState(invitation);
        if (state === "ACCEPTED") throw new GoneError("Invitation already used", "USED");
        if (state === "REVOKED") throw new GoneError("Invitation revoked", "REVOKED");
        if (state === "EXPIRED") throw new GoneError("Invitation expired", "EXPIRED");

        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${invitation.email}`)
          .limit(1);
        if (existing) throw new ConflictError("Account already exists, please log in");

        const [user] = await tx
          .insert(users)
          .values({
            fullName: data.fullName,
            email: invitation.email,
            password: data.passwordHash,
            role: "LEARNER",
          })
          .returning();

        await tx.insert(emailNotificationPreferences).values({
          userId: user.id,
          taskReminders: true,
          weekPreparation: true,
          progressUpdates: true,
          commentNotifications: true,
        });

        const [created] = await tx
          .insert(mentorships)
          .values({
            roadmapId: invitation.roadmapId,
            mentorId: invitation.mentorId,
            learnerId: user.id,
            status: "ACTIVE",
            startedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();
        const mentorship =
          created ??
          (
            await tx
              .select()
              .from(mentorships)
              .where(
                and(
                  eq(mentorships.roadmapId, invitation.roadmapId),
                  eq(mentorships.mentorId, invitation.mentorId),
                  eq(mentorships.learnerId, user.id),
                ),
              )
              .limit(1)
          )[0];

        const [accepted] = await tx
          .update(invitations)
          .set({
            status: "ACCEPTED",
            acceptedAt: new Date(),
            acceptedUserId: user.id,
            updatedAt: new Date(),
          })
          .where(and(eq(invitations.id, invitation.id), eq(invitations.status, "PENDING")))
          .returning();
        if (!accepted) throw new GoneError("Invitation already used", "USED");

        return { user, mentorship, invitation: toSummary(accepted) };
      });
    } catch (error: any) {
      if (error?.code === "23505" && /users_email/.test(String(error.constraint ?? error.message))) {
        throw new ConflictError("Account already exists, please log in");
      }
      throw error;
    }
  }
}
