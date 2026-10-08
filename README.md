# RoadmapMentor

**Mentor-guided learning roadmap platform with progress tracking and AI-assisted roadmap generation.**

RoadmapMentor structures a learning plan into weeks, objectives, tasks, deliverables and resources. Mentors can build or validate roadmaps, while learners track their own progress, submit evidence and follow a clear progression over time.

## Main capabilities

- **Mentor / learner roles** — distinct workflows for roadmap supervision and learning progress
- **Weekly roadmaps** — organize a program into weeks, objectives, tasks, deliverables and resources
- **Progress tracking** — learners mark tasks complete and can attach screenshots as evidence
- **Mentor validation** — weeks can be reviewed and validated by a mentor
- **Comments & follow-up** — learners can comment on weeks and keep progress discussions tied to the roadmap
- **AI roadmap generation** — generate structured learning plans by topic, duration and skill level
- **Andragogical resources** — problem-driven context, supported video/PDF preview, voluntary consultation (not a skill certification), mentor review of AI-imported links and unavailable-link reports
- **Notifications** — configurable email notifications for reminders, validation, progress and collaboration events

## Domain model

```text
Roadmap
  ├── Mentorship
  │    ├── Mentor
  │    └── Learner
  └── Week
       ├── Objectives
       │    └── Tasks
       │         └── Learner progress
       ├── Deliverables
       ├── Resources
       └── Comments
```

A roadmap is an independent learning program. Access is explicit through a mentorship linking a mentor and a learner to that roadmap.

## Stack

- **Frontend:** React 18, TypeScript, Vite
- **Data fetching:** TanStack Query
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Current database adapter:** Neon-compatible PostgreSQL via `@neondatabase/serverless`
- **AI generation:** OpenAI SDK with schema validation
- **Validation:** Zod
- **UI:** Tailwind CSS / Radix-based components

## Run locally from a clean clone

### Prerequisites

- **Node.js 24**
- npm
- a **Neon-compatible PostgreSQL** database
- Git

AI generation, email delivery and screenshot uploads are feature-specific integrations; they are not required to start the core application.

### 1. Clone and install

```bash
git clone https://github.com/EagleFox31/RoadmapMentor.git
cd RoadmapMentor
npm ci
```

### 2. Create the local configuration

Copy the committed template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

At minimum, set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
```

The application must be configured through environment variables. Do not add machine-specific paths, credentials or secrets to source files.

### 3. Apply the database schema

```bash
npm run db:migrate
```

Create new migrations with `npm run db:generate -- --name <description>` (see `docs/deployment.md`). `npm run db:push` is for throwaway local databases only.

### 4. Create the first mentor

```bash
npm run mentor:create -- --email=mentor@example.com "--name=Your Name"
```

See "Mentor accounts" in `docs/deployment.md`. Public sign-up only creates learners.

### 5. Start development

```bash
npm run dev
```

The application listens on:

```text
http://localhost:5000
```

No source-code modification should be required between machines; differences belong in `.env`.

## Configuration reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Database connection used by Drizzle |
| `JWT_SECRET` | Yes outside development | JWT signing/verification secret |
| `PORT` | No | HTTP port; defaults to `5000` |
| `APP_URL` | No | Public application URL used in notification links |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | No | Any OpenAI-compatible provider and model (e.g. DeepSeek: `https://api.deepseek.com`, `deepseek-chat`); `AI_API_KEY` takes priority, `AI_MODEL` defaults to `gpt-4o` |
| `OPENAI_API_KEY` | For direct AI use | Preferred OpenAI credential outside Replit |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI only | Replit AI integration credential |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI only | Replit AI integration endpoint |
| `RESEND_API_KEY` | For email delivery | Resend HTTPS API token; keep it secret |
| `MAIL_FROM` | For email delivery | Verified sender address/domain configured in Resend |
| `OBJECT_STORAGE_PROVIDER` | For screenshot uploads | `filesystem` or `replit`; local/VPS default in `.env.example` is `filesystem` |
| `OBJECT_STORAGE_LOCAL_DIR` | Filesystem provider | Directory for uploaded evidence; defaults to `.data/object-storage` |
| `PRIVATE_OBJECT_DIR` | Replit provider | Replit object-storage bucket/prefix |

Use `.env.example` as the canonical list. Never commit the populated `.env`.
The Render Free deployment uses Resend over HTTPS, not outbound SMTP. Verify the sender domain and configure `RESEND_API_KEY` and `MAIL_FROM` in the hosting environment; code deployment alone does not activate email delivery.

## Upgrade an existing pre-roadmap database

Issue #6 introduces first-class `roadmaps` and `mentorships` while preserving existing data.

Back up the database first. Then apply the schema and run the compatibility migration:

```bash
npm run db:migrate   # existing database: see "Existing databases" in docs/deployment.md
npm run migrate:roadmap-domain
```

The migration is intentionally idempotent. It:

- creates or reuses one **Legacy Roadmap**;
- attaches every pre-existing week whose `roadmap_id` is still null;
- preserves the old global visibility model by creating a legacy mentorship for every existing mentor/learner pair;
- refuses to guess if more than one legacy roadmap exists;
- can be run again after a partial deployment without duplicating memberships.

New roadmaps do **not** inherit that global compatibility behavior. Their access is restricted to the roadmap creator and explicit, non-cancelled mentorships.

## Tâches planifiées

Les rappels de tâches (mercredi et vendredi 10h, `Europe/Paris`) sont configurables : `SCHEDULER_ENABLED`, `SCHEDULER_TIMEZONE`, `SCHEDULER_MIDWEEK_CRON`, `SCHEDULER_ENDWEEK_CRON` (voir `.env.example`). Chaque créneau est réservé dans `scheduled_job_runs` (clé unique job + créneau) : plusieurs instances ou un redémarrage n'envoient qu'un lot par créneau. Un lot en échec est marqué `FAILED` et n'est pas rejoué automatiquement. Pour un worker dédié, mettre `SCHEDULER_ENABLED=false` sur les autres instances.

## Tests

```bash
npm test                      # unit tests (no database required)
npm run test:integration      # API journey mentor / learner (needs a running dev server)
python test/e2e/mentor-learner.e2e.py   # browser journey (Playwright for Python)
python test/e2e/roadmaps-ui.e2e.py      # roadmap creation and learner attachment from the UI
```

Integration and e2e tests need `TEST_BASE_URL` (for example `http://localhost:5000`) and a server started with `NODE_ENV=development` on a **disposable** database: they create users and a roadmap, and use the development-only `/api/auth/create-test-users` route. e2e also needs `pip install playwright && playwright install chromium`.

## Container deployment

A production Dockerfile, local Compose stack and environment-specific examples are included. The same runtime image is configured through environment variables for local, staging, VPS, AWS-compatible and Azure-compatible hosts.

See `docs/deployment.md` for health checks, PostgreSQL proxy configuration, migrations, backups and rollback.

## Validate a change

Before opening or merging a pull request:

```bash
npm run check
npm test
npm run build
```

GitHub Actions currently enforces type checking and regression tests on pull requests and pushes to `main`.

## Object storage

Screenshot/evidence storage is selected through `OBJECT_STORAGE_PROVIDER`; application routes and UI do not depend on a Replit-specific URL.

### Filesystem provider

Use this for local development or a standard Linux/VPS host:

```env
OBJECT_STORAGE_PROVIDER=filesystem
OBJECT_STORAGE_LOCAL_DIR=.data/object-storage
```

Uploads go through the authenticated application endpoint and are stored below the configured directory. ACL metadata is stored alongside each object. The application persists canonical `/objects/...` paths, so changing providers does not change database URLs.

### S3-compatible provider (shared, multi-instance)

```env
OBJECT_STORAGE_PROVIDER=s3
OBJECT_STORAGE_S3_BUCKET=my-bucket
OBJECT_STORAGE_S3_REGION=eu-west-3
OBJECT_STORAGE_S3_ENDPOINT=        # R2 / MinIO / Scaleway only
OBJECT_STORAGE_S3_PREFIX=prod      # optional key prefix
OBJECT_STORAGE_S3_FORCE_PATH_STYLE=false
```

Credentials use the standard AWS chain. The bucket stays private and needs no CORS: uploads and downloads are proxied by the application, which enforces ACLs. ACL policies are stored as object metadata.

### Replit compatibility provider

Existing Replit deployments can keep the original sidecar-backed storage:

```env
OBJECT_STORAGE_PROVIDER=replit
PRIVATE_OBJECT_DIR=/bucket-name/private
```

The Replit sidecar is now isolated inside the Replit adapter rather than being referenced by application routes.

## Current portability limits

The application remains on `@neondatabase/serverless`, but a configurable WebSocket proxy transport now allows the same application code to reach a standard PostgreSQL server. The local Docker stack demonstrates this with PostgreSQL 16 plus the proxy.

The existing `.replit` deployment configuration remains available as a compatibility path; it is no longer the only deployment model.

## AI roadmap generation

The generator accepts a topic, skill level and roadmap duration, then returns validated structured weeks containing objectives, tasks, deliverables and resources.

Generated content is validated before insertion so malformed AI output does not become application data directly.

## Status

Active prototype being converted from a Replit-origin brownfield application into an AppFactory-managed, tested and provider-agnostic product.
