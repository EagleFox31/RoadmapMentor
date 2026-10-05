import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, pool } from "../server/db";
import { planMigration } from "../server/domain/migrationPlan";

const migrationsFolder = path.resolve(process.cwd(), "migrations");
const MIGRATIONS_TABLE = sql`"drizzle"."__drizzle_migrations"`;

async function countRows<T extends Record<string, unknown>>(query: ReturnType<typeof sql>) {
  const result = await db.execute<T>(query);
  return result.rows[0];
}

async function run() {
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) {
    throw new Error(`No migration found in ${migrationsFolder}`);
  }

  const state = await countRows<{ app: boolean; journal: boolean }>(sql`
    select to_regclass('public.users') is not null as app,
           to_regclass('drizzle.__drizzle_migrations') is not null as journal
  `);
  const applied = state.journal
    ? Number((await countRows<{ n: string }>(sql`select count(*)::int as n from ${MIGRATIONS_TABLE}`)).n)
    : 0;

  const action = planMigration({
    hasApplicationTables: Boolean(state.app),
    appliedMigrations: applied,
    baselineExisting: process.env.MIGRATE_BASELINE_EXISTING === "true",
  });

  if (action === "baseline-then-migrate") {
    const [initial] = migrations;
    await db.execute(sql`create schema if not exists "drizzle"`);
    await db.execute(sql`
      create table if not exists ${MIGRATIONS_TABLE} (
        id serial primary key, hash text not null, created_at bigint
      )
    `);
    await db.execute(sql`
      insert into ${MIGRATIONS_TABLE} ("hash", "created_at")
      values (${initial.hash}, ${initial.folderMillis})
    `);
    console.log("[migrate] Existing schema recorded as the initial migration (baseline).");
  }

  await migrate(db, { migrationsFolder });
  console.log("[migrate] Database is up to date.");
}

run()
  .catch((error) => {
    console.error("[migrate] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
