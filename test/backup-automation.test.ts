import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("nightly Neon/R2 backup is opt-in and never runs on pull requests", () => {
  const workflow = readFileSync(".github/workflows/neon-r2-backup.yml", "utf8");
  assert.match(workflow, /cron:\s*"17 2 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s*pull_request:/);
  assert.match(workflow, /if:.*vars\.RM_BACKUPS_ENABLED == 'true'/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /needs\.backup\.result == 'failure'/);
  assert.match(workflow, /gh issue comment 34/);
  for (const secret of [
    "RM_NEON_UNPOOLED_URL",
    "RM_BACKUP_R2_ACCESS_KEY_ID",
    "RM_BACKUP_R2_SECRET_ACCESS_KEY",
  ]) assert.match(workflow, new RegExp("secrets\\." + secret));
});

test("backup and restore require evidence inventory parity before claiming success", () => {
  const snapshot = readFileSync("scripts/backup/neon-r2-snapshot.sh", "utf8");
  const restore = readFileSync("scripts/backup/verify-restore.sh", "utf8");
  assert.match(snapshot, /SOURCE_COUNT/);
  assert.match(snapshot, /incomplete evidence copy/);
  assert.match(snapshot, /manifest\.json/);
  assert.ok(snapshot.indexOf("incomplete evidence copy") < snapshot.lastIndexOf("manifest.json"));
  assert.match(restore, /EXPECTED_COUNT/);
  assert.match(restore, /incomplete evidence restore/);
  assert.match(restore, /PGDATABASE="\$RECOVERY_DATABASE_URL" pg_restore/);
  assert.doesNotMatch(restore, /pg_restore[^\n]*-d "\$RECOVERY_DATABASE_URL"/);
});
