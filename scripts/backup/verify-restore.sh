#!/usr/bin/env bash
set -euo pipefail
umask 077
die() { printf 'restore: %s\n' "$*" >&2; exit 1; }
[[ "${CONFIRM_DISPOSABLE_RECOVERY:-}" == "YES" ]] || die "set CONFIRM_DISPOSABLE_RECOVERY=YES for isolated recovery only"
for name in BACKUP_RUN_ID R2_ENDPOINT R2_BACKUP_BUCKET R2_EVIDENCE_BUCKET R2_RECOVERY_BUCKET RECOVERY_DATABASE_URL AGE_IDENTITY_FILE; do
  [[ -n "${!name:-}" ]] || die "missing $name"
done
[[ "$BACKUP_RUN_ID" =~ ^[A-Za-z0-9_-]{8,70}$ ]] || die "invalid backup generation"
[[ "$R2_ENDPOINT" == https://* ]] || die "R2 endpoint must use HTTPS"
[[ "$R2_RECOVERY_BUCKET" != "$R2_EVIDENCE_BUCKET" ]] || die "cannot restore into the live evidence bucket"
[[ "$R2_RECOVERY_BUCKET" != "$R2_BACKUP_BUCKET" ]] || die "cannot restore into the backup bucket"
[[ -z "${NEON_BACKUP_DATABASE_URL:-}" || "$RECOVERY_DATABASE_URL" != "$NEON_BACKUP_DATABASE_URL" ]] || die "cannot restore to the production database"
[[ -f "$AGE_IDENTITY_FILE" ]] || die "age identity file missing"
for cmd in aws age sha256sum pg_restore; do command -v "$cmd" >/dev/null || die "missing $cmd"; done

SOURCE="s3://$R2_BACKUP_BUCKET/roadmapmentor/$BACKUP_RUN_ID"
TARGET="s3://$R2_RECOVERY_BUCKET/recovery/$BACKUP_RUN_ID"
[[ -z "$(aws --endpoint-url "$R2_ENDPOINT" s3 ls "$TARGET/" --recursive)" ]] || die "recovery prefix already occupied"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

aws --endpoint-url "$R2_ENDPOINT" s3 cp "$SOURCE/manifest.json" "$WORK/manifest.json" --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$SOURCE/neon.dump.age" "$WORK/neon.dump.age" --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$SOURCE/neon.dump.age.sha256" "$WORK/neon.dump.age.sha256" --only-show-errors
printf '%s  %s\n' "$(cat "$WORK/neon.dump.age.sha256")" "$WORK/neon.dump.age" | sha256sum -c - >/dev/null

age -d -i "$AGE_IDENTITY_FILE" -o "$WORK/neon.dump" "$WORK/neon.dump.age"
pg_restore --list "$WORK/neon.dump" >/dev/null
# Only use a brand-new empty disposable database. Never pass the production
# URL: the confirmation flag is NOT a substitute for human verification.
# Use a libpq environment variable: do not expose connection credentials in
# process command arguments (ps). Recovery must be a fresh disposable DB.
PGDATABASE="$RECOVERY_DATABASE_URL" pg_restore --exit-on-error --single-transaction --no-owner --no-privileges "$WORK/neon.dump"

# Prevent a partial evidence restore from being mistaken for success. This is
# an inventory count, not a metadata or ACL verification (still required live).
EXPECTED_COUNT="$(sed -n 's/.*"evidenceCount":\([0-9][0-9]*\).*/\1/p' "$WORK/manifest.json")"
[[ "$EXPECTED_COUNT" =~ ^[0-9]+$ ]] || die "invalid evidence count in snapshot manifest"
if [[ "$EXPECTED_COUNT" -gt 0 ]]; then
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "$SOURCE/evidence/" "$TARGET/" \
    --recursive --metadata-directive COPY --only-show-errors
fi
COPIED_COUNT="$(aws --endpoint-url "$R2_ENDPOINT" s3 ls "$TARGET/" --recursive | awk 'END {print NR+0}')"
[[ "$COPIED_COUNT" == "$EXPECTED_COUNT" ]] || die "incomplete evidence restore: counts differ"
printf 'restore: staged backup=%s verified_objects=%s; manually verify database records, ACL metadata and app access\n' "$BACKUP_RUN_ID" "$COPIED_COUNT"
