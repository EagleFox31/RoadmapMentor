# Lessons learned

## 2026-10-05 — Defects found by the mentor/learner test campaign

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| `npm run dev` crashes on Windows (`ENOTSUP`) | `listen({ reusePort: true })` is unsupported on Windows | `reusePort` only set when `process.platform !== "win32"` | Run the integration/e2e suites on the target OS |
| Sign-up from the UI always failed | Form sent `role`; `publicRegistrationSchema` is strict (correct, anti-escalation) | Removed the role selector and field from the sign-up form | `test/e2e` registers through the UI and asserts no role selector; integration test asserts the server rejects `role` |
| Validation errors returned HTTP 500 | `handleError` treated every error as internal | `ZodError` now returns 400 with `issues` | Integration test asserts 400 on invalid payload |
| `docker compose` DB proxy refused connections (`postgres:5432postgres:5432`) | `APPEND_PORT` duplicates the port the Neon driver already sends | Removed `APPEND_PORT` from `db-proxy` | Verified end to end against the compose Postgres |
| `.env` ignored by `npm run dev`; `NODE_ENV=…` prefix fails in Windows cmd | Nothing loaded `.env` (Replit injected env); script relied on a POSIX-only env prefix | `dev` uses `tsx --env-file-if-exists=.env`; `NODE_ENV` defaults to `development` in `index-dev.ts` | Integration run starts the server through `npm run dev` |
| Learner could act (toggle, comment) on a week they cannot list | Only `GET /api/weeks` filtered unvalidated weeks | Rule moved into `canAccessWeek`, shared by every week-scoped route | Integration test: unvalidated week is 404 for the learner on read and on progress |
| AI generation failed on `resourceType: "EXERCISE"` (DeepSeek) | Strict enum on provider output | Unknown `type` / `resourceType` degrade to `OTHER` | Opt-in `TEST_AI=1` integration test against the configured provider |

Generalised lesson: contract changes between layers (strict API schema vs. form payload) need a test that crosses the layers, not only unit tests on each side.
