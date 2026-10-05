import { randomBytes } from "node:crypto";
import { z } from "zod";

export const MIN_MENTOR_PASSWORD_LENGTH = 12;

export const mentorProvisioningSchema = z.object({
  fullName: z.string().trim().min(1, "fullName is required"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("email is invalid"),
  password: z
    .string()
    .min(MIN_MENTOR_PASSWORD_LENGTH, `password must contain at least ${MIN_MENTOR_PASSWORD_LENGTH} characters`),
});

export type MentorProvisioningInput = z.infer<typeof mentorProvisioningSchema>;

export type ProvisioningOutcome = "create" | "noop";

/**
 * Idempotent decision for provisioning a mentor account.
 * An existing mentor with the same email is left untouched; an existing account with another
 * role is never promoted silently.
 */
export function planMentorProvisioning(existingRole: "MENTOR" | "LEARNER" | undefined): ProvisioningOutcome {
  if (!existingRole) return "create";
  if (existingRole === "MENTOR") return "noop";
  throw new Error(
    "An account with this email already exists with the LEARNER role. Refusing to change its role; use another email.",
  );
}

export function generateMentorPassword(): string {
  return randomBytes(18).toString("base64url");
}
