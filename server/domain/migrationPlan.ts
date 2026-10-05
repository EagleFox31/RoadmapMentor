export type MigrationAction = "migrate" | "baseline-then-migrate";

export interface MigrationPlanInput {
  /** Application tables already exist (database created before versioned migrations). */
  hasApplicationTables: boolean;
  /** Number of rows in the Drizzle migration journal. */
  appliedMigrations: number;
  /** Operator explicitly confirmed the existing schema matches the initial migration. */
  baselineExisting: boolean;
}

/**
 * Decide how to bring a database up to date.
 * - empty database or journal already present: apply pending migrations;
 * - pre-existing schema without journal: refuse unless the operator asked for a baseline,
 *   because replaying the initial migration would fail or, worse, partially apply.
 */
export function planMigration(input: MigrationPlanInput): MigrationAction {
  if (input.appliedMigrations > 0 || !input.hasApplicationTables) {
    return "migrate";
  }
  if (!input.baselineExisting) {
    throw new Error(
      "The database already contains application tables but no migration history. " +
        "Back it up, then rerun with MIGRATE_BASELINE_EXISTING=true to record the initial " +
        "migration as applied (see docs/deployment.md).",
    );
  }
  return "baseline-then-migrate";
}
