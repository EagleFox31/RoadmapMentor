import test from "node:test";
import assert from "node:assert/strict";
import { updateEmailNotificationPreferencesSchema } from "../shared/schema";

test("notification preference update accepts a partial boolean payload", () => {
  const parsed = updateEmailNotificationPreferencesSchema.parse({
    taskReminders: false,
    weeklyReports: true,
  });

  assert.deepEqual(parsed, {
    taskReminders: false,
    weeklyReports: true,
  });
});

test("notification preference update rejects non-boolean values", () => {
  assert.throws(() =>
    updateEmailNotificationPreferencesSchema.parse({
      taskReminders: "false",
    }),
  );
});

test("notification preference update rejects account identity fields", () => {
  assert.throws(() =>
    updateEmailNotificationPreferencesSchema.parse({
      userId: 999,
      taskReminders: false,
    }),
  );
});

test("notification preference update rejects unknown fields", () => {
  assert.throws(() =>
    updateEmailNotificationPreferencesSchema.parse({
      taskReminders: false,
      adminOverride: true,
    }),
  );
});
