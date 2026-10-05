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

The current repository uses Drizzle's schema push workflow.

Before an application rollout:

1. back up the database;
2. run the schema job against the target database;
3. verify the schema job completed successfully;
4. roll out the application image;
5. verify `/health/ready`.

With Docker Compose:

```bash
docker compose run --rm migrate
docker compose up -d app
```

For hosted environments, run `npm run db:push` from the build/migration image as a one-off release step before shifting traffic.

For a larger team or destructive schema changes, replace direct schema push with committed, versioned Drizzle migrations before production rollout.

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
