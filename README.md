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
- **Notifications** — configurable email notifications for reminders, validation, progress and collaboration events

## Domain model

```text
Roadmap
  └── Week
       ├── Objectives
       │    └── Tasks
       │         └── Learner progress
       ├── Deliverables
       ├── Resources
       └── Comments
```

> The persisted domain is still being evolved toward first-class Roadmap and Mentorship entities. See the repository backlog for the current migration work.

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
npm run db:push
```

### 4. Start development

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
| `OPENAI_API_KEY` | For direct AI use | Preferred OpenAI credential outside Replit |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI only | Replit AI integration credential |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI only | Replit AI integration endpoint |
| `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` | For email delivery | SMTP transport |
| `MAIL_PORT` | No | SMTP port; defaults to `465` |
| `MAIL_FROM` | No | Sender identity |
| `PRIVATE_OBJECT_DIR` | For screenshot uploads | Current Replit object-storage location |

Use `.env.example` as the canonical list. Never commit the populated `.env`.

## Validate a change

Before opening or merging a pull request:

```bash
npm run check
npm test
npm run build
```

GitHub Actions currently enforces type checking and regression tests on pull requests and pushes to `main`.

## Current portability limits

The repository can now be configured without editing source files, but two infrastructure adapters are still intentionally documented as brownfield constraints:

1. **Database** — the current driver is `@neondatabase/serverless`; a generic local PostgreSQL container is not yet guaranteed by this adapter.
2. **Screenshot storage** — signing and credentials still use the Replit object-storage sidecar.

Those constraints are tracked separately so this cleanup does not silently change infrastructure behavior. The existing `.replit` deployment configuration is therefore retained until the provider-agnostic containerization/storage work lands.

## AI roadmap generation

The generator accepts a topic, skill level and roadmap duration, then returns validated structured weeks containing objectives, tasks, deliverables and resources.

Generated content is validated before insertion so malformed AI output does not become application data directly.

## Status

Active prototype being converted from a Replit-origin brownfield application into an AppFactory-managed, tested and provider-agnostic product.
