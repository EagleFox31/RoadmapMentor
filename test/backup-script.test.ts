import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const backup = resolve("scripts/backup/neon-r2-snapshot.sh");
const restore = resolve("scripts/backup/verify-restore.sh");

function run(script: string, env: Record<string, string>) {
  return spawnSync("bash", [script], { env: { ...process.env, ...env }, encoding: "utf8", timeout: 15000 });
}
function executable(bin: string, name: string, lines: string[]) {
  const path = join(bin, name);
  writeFileSync(path, "#!/usr/bin/env bash\nset -euo pipefail\n" + lines.join("\n") + "\n");
  chmodSync(path, 0o755);
}
function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "rm034-"));
  const bin = join(root, "bin"), store = join(root, "store");
  mkdirSync(bin);
  mkdirSync(join(store, "live", "uploads"), { recursive: true });
  writeFileSync(join(store, "live", "uploads", "sample.png"), "fake screenshot bytes");
  executable(bin, "pg_dump", [
    '[[ -n "$PGDATABASE" ]] || exit 20',
    '[[ "$MOCK_DUMP_FAIL" != "yes" ]] || exit 21',
    'while [[ "$#" -gt 0 ]]; do',
    '  if [[ "$1" == "-f" ]]; then printf "mock archive" > "$2"; exit 0; fi',
    '  shift',
    'done',
    'exit 22',
  ]);
  executable(bin, "pg_restore", [
    'if [[ "$*" == *"--exit-on-error"* ]]; then test -n "$PGDATABASE"; fi',
    'exit 0',
  ]);
  executable(bin, "age", [
    'out=""; input=""',
    'while [[ "$#" -gt 0 ]]; do',
    '  if [[ "$1" == "-o" ]]; then out="$2"; shift 2; continue; fi',
    '  if [[ "$1" == "-i" || "$1" == "-r" ]]; then shift 2; continue; fi',
    '  if [[ "$1" == "-d" ]]; then shift; continue; fi',
    '  input="$1"; shift',
    'done',
    'cp "$input" "$out"',
  ]);
  executable(bin, "aws", [
    'if [[ "$1" == "--endpoint-url" ]]; then shift 2; fi',
    '[[ "$1" == "s3" ]] || exit 23',
    'shift',
    'operation="$1"; shift',
    'map_path() {',
    '  case "$1" in',
    '    s3://*) printf "%s/%s" "$AWS_MOCK_ROOT" "@@{1#s3://}" ;;',
    '    *) printf "%s" "$1" ;;',
    '  esac',
    '}',
    'if [[ "$operation" == "ls" ]]; then',
    '  source="$(map_path "$1")"',
    '  if [[ -d "$source" ]]; then find "$source" -type f; fi',
    '  exit 0',
    'fi',
    '[[ "$operation" == "cp" ]] || exit 24',
    'source="$(map_path "$1")"',
    'target="$(map_path "$2")"',
    'for argument in "$@"; do',
    '  if [[ "$argument" == "--recursive" ]]; then',
    '    mkdir -p "$target"',
    '    cp -R "$source/." "$target/"',
    '    exit 0',
    '  fi',
    'done',
    'mkdir -p "$(dirname "$target")"',
    'cp "$source" "$target"',
  ].map(line => line.replaceAll("@@{", "$" + "{")));
  const identity = join(root, "age-identity.txt");
  writeFileSync(identity, "mock test identity");
  const env = {
    PATH: bin + ":" + (process.env.PATH ?? ""),
    AWS_MOCK_ROOT: store,
    MOCK_DUMP_FAIL: "no",
    NEON_BACKUP_DATABASE_URL: "postgresql://demo@prod.invalid/app",
    R2_ENDPOINT: "https://r2.invalid",
    R2_EVIDENCE_BUCKET: "live",
    R2_BACKUP_BUCKET: "backup",
    R2_RECOVERY_BUCKET: "recovery",
    AGE_RECIPIENT: "age1testpublic",
    AGE_IDENTITY_FILE: identity,
    BACKUP_RUN_ID: "20261008-test-run",
    RECOVERY_DATABASE_URL: "postgresql://demo@recovery.invalid/restore",
    CONFIRM_DISPOSABLE_RECOVERY: "YES",
  };
  return { root, store, env, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("backup and restore fail closed on unsafe targets", { skip: process.platform === "win32" }, () => {
  const s = createFixture();
  try {
    assert.notEqual(run(backup, { ...s.env, R2_BACKUP_BUCKET: "live" }).status, 0);
    assert.notEqual(run(backup, { ...s.env, NEON_BACKUP_DATABASE_URL: "postgresql://pooler.invalid/app" }).status, 0);
    assert.notEqual(run(restore, { ...s.env, CONFIRM_DISPOSABLE_RECOVERY: "NO" }).status, 0);
    assert.notEqual(run(restore, { ...s.env, R2_RECOVERY_BUCKET: "live" }).status, 0);
    assert.notEqual(run(restore, { ...s.env, RECOVERY_DATABASE_URL: s.env.NEON_BACKUP_DATABASE_URL }).status, 0);
    assert.equal(existsSync(join(s.store, "backup", "roadmapmentor")), false);
  } finally { s.cleanup(); }
});

test("disposable CLI mocks complete snapshot and isolated restore", { skip: process.platform === "win32" }, () => {
  const s = createFixture();
  try {
    const first = run(backup, s.env);
    assert.equal(first.status, 0, first.stderr);
    const destination = join(s.store, "backup", "roadmapmentor", s.env.BACKUP_RUN_ID);
    const manifest = JSON.parse(readFileSync(join(destination, "manifest.json"), "utf8"));
    assert.equal(manifest.evidenceCount, 1);
    assert.match(manifest.databaseEncryptedSha256, /^[a-f0-9]{64}$/);
    assert.equal(existsSync(join(destination, "evidence", "uploads", "sample.png")), true);
    assert.notEqual(run(backup, s.env).status, 0, "cannot overwrite an existing backup generation");
    const restored = run(restore, s.env);
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(existsSync(join(s.store, "recovery", "recovery", s.env.BACKUP_RUN_ID, "uploads", "sample.png")), true);
  } finally { s.cleanup(); }
});

test("failed dump never writes a success manifest", { skip: process.platform === "win32" }, () => {
  const s = createFixture();
  try {
    assert.notEqual(run(backup, { ...s.env, MOCK_DUMP_FAIL: "yes" }).status, 0);
    assert.equal(existsSync(join(s.store, "backup", "roadmapmentor", s.env.BACKUP_RUN_ID, "manifest.json")), false);
  } finally { s.cleanup(); }
});
