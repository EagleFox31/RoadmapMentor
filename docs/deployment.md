# Deployment guide

RoadmapMentor ships as one application image. Environment variables decide where PostgreSQL, object storage, email and AI services live; the application source does not change between local, staging and production.

## Runtime contract

Required:

- `DATABASE_URL`
- `JWT_SECRET`

Common:

- `PORT` — defaults to `5000`
- `APP_URL`
- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_LOCAL_DIR`
- `DATABASE_WS_PROXY` and `DATABASE_WS_PROXY_INSECURE` when the Neon serverless driver is pointed at a standard PostgreSQL server through a WebSocket proxy

Optional integrations remain configured through environment variables.

## Local Docker stack

The repository includes:

- the RoadmapMentor application image;
- PostgreSQL 16;
- Neon's open-source WebSocket proxy, allowing the existing serverless PostgreSQL driver to talk to the standard PostgreSQL container;
- an explicit schema migration job;
- a persistent volume for PostgreSQL;
- a persistent volume for screenshot/evidence storage.

Start everything:

```bash
docker compose up --build
```

The application is available on `http://localhost:5000`.

The Compose stack deliberately configures `OBJECT_STORAGE_PROVIDER=filesystem`; evidence is written to a named Docker volume and the database stores only canonical `/objects/...` paths.

## Health checks

- `GET /health/live` confirms that the HTTP process is alive.
- `GET /health/ready` performs a lightweight database query and returns `503` when the application should not receive traffic.

Use `/health/ready` for an external load balancer or container-orchestrator readiness check.

## Build once, configure per environment

Build and tag an immutable image:

```bash
docker build --target runtime -t roadmapmentor:2026-10-04 .
```

Run it on any Linux container host:

```bash
docker run --rm \
  -p 5000:5000 \
  --env-file .env.production \
  -v roadmapmentor-evidence:/app/data \
  roadmapmentor:2026-10-04
```

For a Neon database, leave `DATABASE_WS_PROXY` empty.

For a standard PostgreSQL database while the application still uses `@neondatabase/serverless`, deploy a WebSocket proxy next to the application and set `DATABASE_WS_PROXY`. This transport detail is configuration, not application code.

## Schema changes

Schema changes ship as committed, versioned Drizzle migrations in `migrations/`. `npm run db:push` remains a local prototyping shortcut only; never use it against a shared or production database.

### Authoring a change

1. edit `shared/schema.ts`;
2. run `npm run db:generate -- --name <short_description>` and review the generated SQL (destructive statements such as `DROP` need an explicit data plan);
3. commit the SQL file and the `migrations/meta` updates together with the schema change.

CI (`migrations` gate) fails when the schema and the committed migrations diverge, and builds an empty database from the migrations alone, twice, to prove replay safety.

### Applying a release

Migrations run as a release step separate from the application:

1. back up the database;
2. run `npm run db:migrate` against the target database;
3. verify the job completed successfully;
4. roll out the application image;
5. verify `/health/ready`.

With Docker Compose:

```bash
docker compose run --rm migrate
docker compose up -d app
```

For hosted environments, run `npm run db:migrate` from the build/migration image as a one-off release step before shifting traffic. The runner uses the same `DATABASE_URL` / `DATABASE_WS_PROXY*` settings as the application.

### Existing databases created with `db:push`

A database that already holds the application tables but has no migration history is refused on purpose. After a backup, and once you have confirmed the schema is current (run `npx drizzle-kit push` once on the old code path if unsure), record the initial migration as applied, then apply anything newer:

```bash
MIGRATE_BASELINE_EXISTING=true npm run db:migrate
```

This inserts the initial migration into `drizzle.__drizzle_migrations` without executing it. Later runs need no flag.

### Recovery

A failed migration is not rolled back by the application rollback. Restore the pre-release backup or ship a reviewed forward fix. The runner applies all pending migrations in a single transaction, so a failing run leaves no partial change.

The legacy data migration (`npm run migrate:roadmap-domain`) stays an explicit, separate step after `db:migrate`.

## Mentor accounts

Public registration only ever creates `LEARNER` accounts: the API rejects any `role` field. Mentors are provisioned by an operator with access to the target database; there is no unauthenticated path.

Create the first mentor of a new installation (after the schema is applied):

```bash
npm run mentor:create -- --email=mentor@example.com "--name=Ada Lovelace"
```

- The password is generated and printed once; to choose it, set `MENTOR_PASSWORD` (at least 12 characters) in the environment instead of passing it as an argument. Ask the mentor to change it after the first login.
- The command is idempotent: an existing mentor with the same email is left untouched. An existing `LEARNER` account is never promoted; use another email.
- Each creation writes an `[audit] ... mentor_created userId=... operator=...` line to the command output (never the password). Keep release/operator logs to retain the trail.
- In containers, run it from the build image with the same `DATABASE_URL` / `DATABASE_WS_PROXY*` settings as the app, e.g. `docker compose run --rm migrate npm run mentor:create -- --email=... "--name=..."`.

## Backup and restore

Example PostgreSQL backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=roadmapmentor.dump
```

Restore into an empty/recovery database:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" roadmapmentor.dump
```

Evidence files must be backed up separately when using the filesystem adapter. On a VPS this means the mounted evidence volume/directory, not the container filesystem.

## Rollback

Application rollback should be image-based:

1. keep the previous immutable image tag;
2. stop traffic to the failed revision;
3. start the previous image using the same environment variables and persistent volumes;
4. verify `/health/ready`;
5. shift traffic back.

Do not automatically reverse database changes during an application rollback. If a schema change is incompatible, restore from the pre-release backup or apply a reviewed forward fix.

## VPS deployment

A standard Linux VPS can run the same `runtime` image under Docker/Compose. Put Nginx, Caddy or another reverse proxy in front for TLS and route traffic to port `5000`.

A single-host deployment can use the filesystem object-storage adapter with a persistent disk. Never keep evidence only in the writable container layer.

## AWS-compatible deployment

The application image can run on EC2 or ECS. An ALB can probe `/health/ready`. PostgreSQL can remain external or be self-hosted; if it is not Neon-compatible, deploy the WebSocket proxy and inject its address through `DATABASE_WS_PROXY`.

For a single-instance deployment, the filesystem adapter can use a persistent EBS-backed mount. Horizontal multi-instance storage should use a shared object-storage adapter rather than per-instance filesystems.

## Azure-compatible deployment

The same image can run on a Linux VM, Azure Container Apps or another container host. Configure the readiness probe with `/health/ready`, inject the database/storage environment variables, and mount persistent storage when using the filesystem adapter.

As on AWS, multi-instance deployments should not rely on a local per-instance evidence directory.

## Configuration separation

Use the examples as templates, never as secret stores:

- `.env.example` — local developer baseline;
- `.env.staging.example` — staging shape;
- `.env.production.example` — production shape.

Real credentials belong in the environment or the chosen secret-management system and must not be committed.

## HTTP hardening (RM-009)

- **Headers**: `helmet` on every response; strict CSP in production only (same-origin scripts, Google Fonts, signed uploads to `storage.googleapis.com`). If a new external origin is needed, extend `contentSecurityPolicy()` in `server/http/hardening.ts`.
- **Rate limits** (per IP for sign-in/sign-up, per user otherwise; in memory, so per instance until a shared store exists — RM-011/RM-012): auth 20 / 15 min, AI generation 10 / h, uploads 60 / 15 min, jobs 6 / h. Override with `RATE_LIMIT_<AUTH|AI|UPLOAD|JOBS>_MAX` and `_WINDOW_MS`.
- **Behind a reverse proxy / load balancer** set `TRUST_PROXY=<number of hops>` (usually `1`), otherwise every client shares the proxy's IP and the auth limit.
- **Bodies**: JSON and form bodies capped at 1 MB; uploads at 5 MB and limited to PNG, JPEG, WebP, GIF (SVG refused). AI input: topic 200 characters, context 2000.

## Shared object storage (S3-compatible)

Multi-instance deployments must use `OBJECT_STORAGE_PROVIDER=s3` so all instances read the same evidence. Variables: `OBJECT_STORAGE_S3_BUCKET` (required), `OBJECT_STORAGE_S3_REGION`, `OBJECT_STORAGE_S3_ENDPOINT`, `OBJECT_STORAGE_S3_PREFIX`, `OBJECT_STORAGE_S3_FORCE_PATH_STYLE`. Grant the runtime identity only `s3:GetObject`, `s3:PutObject` and `s3:ListBucket` on the bucket/prefix; block all public access.

### Migrating from the filesystem provider

The database stores canonical `/objects/...` paths, so no row changes. 

1. Configure the S3 variables next to the existing `OBJECT_STORAGE_LOCAL_DIR`.
2. `npm run storage:migrate -- --dry-run`, then `npm run storage:migrate` (idempotent, source untouched, re-run after the cutover to catch late uploads).
3. Switch `OBJECT_STORAGE_PROVIDER=s3` and redeploy; keep the old directory until verified.

### Backup, retention and deletion

- Enable bucket versioning and a lifecycle rule (suggested: keep non-current versions 30 days).
- Evidence is retained as long as the learner account exists; deleting an account must be followed by deleting its objects (owner is recorded in the ACL metadata).
- Replicate the bucket cross-region or snapshot it daily according to the provider's tooling; the filesystem directory, if still used, is backed up as a plain volume.
