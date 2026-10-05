import assert from "node:assert/strict";
import test from "node:test";
import { planMigration } from "../server/domain/migrationPlan";

test("empty database applies migrations", () => {
  assert.equal(
    planMigration({ hasApplicationTables: false, appliedMigrations: 0, baselineExisting: false }),
    "migrate",
  );
});

test("database with history applies pending migrations", () => {
  assert.equal(
    planMigration({ hasApplicationTables: true, appliedMigrations: 2, baselineExisting: false }),
    "migrate",
  );
});

test("pre-existing schema without history is refused unless baselined explicitly", () => {
  assert.throws(
    () => planMigration({ hasApplicationTables: true, appliedMigrations: 0, baselineExisting: false }),
    /MIGRATE_BASELINE_EXISTING/,
  );
  assert.equal(
    planMigration({ hasApplicationTables: true, appliedMigrations: 0, baselineExisting: true }),
    "baseline-then-migrate",
  );
});
