#!/usr/bin/env bash
set -euo pipefail
umask 077
die() { printf 'backup: %s\n' "$*" >&2; exit 1; }
for name in NEON_BACKUP_DATABASE_URL R2_ENDPOINT R2_EVIDENCE_BUCKET R2_BACKUP_BUCKET AGE_RECIPIENT; do
  [[ -n "${!name:-}" ]] || die "missing $name"
done
[[ "$R2_EVIDENCE_BUCKET" != "$R2_BACKUP_BUCKET" ]] || die "source and backup buckets must differ"
[[ "$R2_ENDPOINT" == https://* ]] || die "R2 endpoint must use HTTPS"
[[ "$NEON_BACKUP_DATABASE_URL" != *pooler* ]] || die "use a Neon unpooled connection"
for cmd in pg_dump pg_restore age aws sha256sum; do command -v "$cmd" >/dev/null || die "missing $cmd"; done

RUN_ID="${BACKUP_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')}"
[[ "$RUN_ID" =~ ^[A-Za-z0-9_-]{8,70}$ ]] || die "invalid backup generation"
DEST="s3://$R2_BACKUP_BUCKET/roadmapmentor/$RUN_ID"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
if [[ -n "$(aws --endpoint-url "$R2_ENDPOINT" s3 ls "$DEST/" --recursive)" ]]; then
  die "backup generation already exists"
fi

# The app's pooled database URL is not used for exports. Avoid DB URL in argv.
PGDATABASE="$NEON_BACKUP_DATABASE_URL" pg_dump --format=custom --no-owner --no-privileges -f "$WORK/neon.dump"
pg_restore --list "$WORK/neon.dump" >/dev/null
age -r "$AGE_RECIPIENT" -o "$WORK/neon.dump.age" "$WORK/neon.dump"
sha256sum "$WORK/neon.dump.age" | awk '{print $1}' > "$WORK/neon.dump.age.sha256"

# Copy with metadata preserved (including the app ACL owner). Never use --delete.
aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://$R2_EVIDENCE_BUCKET/" "$DEST/evidence/" --recursive --metadata-directive COPY --only-show-errors
COUNT="$(aws --endpoint-url "$R2_ENDPOINT" s3 ls "$DEST/evidence/" --recursive | awk 'END {print NR+0}')"
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$WORK/neon.dump.age" "$DEST/neon.dump.age" --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$WORK/neon.dump.age.sha256" "$DEST/neon.dump.age.sha256" --only-show-errors
HASH="$(cat "$WORK/neon.dump.age.sha256")"
CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"version":1,"runId":"%s","createdAt":"%s","databaseEncryptedSha256":"%s","evidenceCount":%s}\n' "$RUN_ID" "$CREATED" "$HASH" "$COUNT" > "$WORK/manifest.json"
# Write the manifest LAST. A generation without this file is incomplete.
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$WORK/manifest.json" "$DEST/manifest.json" --only-show-errors
printf 'backup: completed generation=%s objects=%s\n' "$RUN_ID" "$COUNT"
