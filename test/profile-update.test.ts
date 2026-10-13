import test from "node:test";
import assert from "node:assert/strict";
import { updateProfileSchema } from "../shared/schema";

test("updateProfileSchema accepts a trimmed name change alone", () => {
  assert.deepEqual(updateProfileSchema.parse({ fullName: "  Ada Lovelace " }), { fullName: "Ada Lovelace" });
});

test("updateProfileSchema requires the current password for a password change", () => {
  assert.equal(updateProfileSchema.safeParse({ newPassword: "Longenough1" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ currentPassword: "old", newPassword: "Longenough1" }).success, true);
});

test("updateProfileSchema rejects short passwords and unknown fields", () => {
  assert.equal(updateProfileSchema.safeParse({ currentPassword: "old", newPassword: "short" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ fullName: "Ada", role: "MENTOR" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ fullName: "Ada", email: "x@y.z" }).success, false);
});
