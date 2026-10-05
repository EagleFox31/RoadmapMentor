import assert from "node:assert/strict";
import test from "node:test";
import {
  generateMentorPassword,
  mentorProvisioningSchema,
  planMentorProvisioning,
} from "../server/domain/mentorProvisioning";

test("normalizes the email and trims the name", () => {
  const parsed = mentorProvisioningSchema.parse({
    fullName: "  Ada Lovelace ",
    email: " Ada@Example.COM ",
    password: "a-long-enough-password",
  });
  assert.equal(parsed.email, "ada@example.com");
  assert.equal(parsed.fullName, "Ada Lovelace");
});

test("rejects weak passwords, invalid emails and missing names", () => {
  assert.throws(() => mentorProvisioningSchema.parse({ fullName: "A", email: "a@b.co", password: "short" }));
  assert.throws(() => mentorProvisioningSchema.parse({ fullName: "A", email: "nope", password: "a-long-enough-password" }));
  assert.throws(() => mentorProvisioningSchema.parse({ fullName: " ", email: "a@b.co", password: "a-long-enough-password" }));
});

test("provisioning is idempotent and never promotes a learner", () => {
  assert.equal(planMentorProvisioning(undefined), "create");
  assert.equal(planMentorProvisioning("MENTOR"), "noop");
  assert.throws(() => planMentorProvisioning("LEARNER"), /LEARNER/);
});

test("generated passwords satisfy the policy and are unique", () => {
  const a = generateMentorPassword();
  const b = generateMentorPassword();
  assert.ok(a.length >= 12);
  assert.notEqual(a, b);
  mentorProvisioningSchema.parse({ fullName: "A", email: "a@b.co", password: a });
});
