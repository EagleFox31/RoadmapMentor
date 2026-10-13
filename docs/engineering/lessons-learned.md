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

## 2026-10-06 — Editing and merge-order incidents (RM-010/011)

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| A class was duplicated in a source file after a scripted edit | Edit done by string slicing (`index()` without bounding the search after the start marker), matching the wrong occurrence | Duplicate removed, file re-checked with `tsc` | Edit with the Edit tool or scripts that assert a single match; run `tsc` right after any scripted edit |
| RM-011 landed in the RM-010 branch instead of `main` | Stacked PRs: the base PR was merged first while the child still targeted its branch | Recovered through a follow-up PR to `main` (#49) | Retarget a stacked PR to `main` before merging its base; verify `main` contains the commits after merge |

Generalised lesson: any mechanical edit or merge sequence needs a cheap post-condition check (compile, `git log main`) before moving on.

## 2026-10-07 — Integration suites on a production build (RM-007)

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| New suites could not provision a second mentor against a production build | `create-test-users` exists in development only and creates a single mentor | `ensureMentor` provisions through `scripts/create-mentor.ts` (12+ character password policy), usable in dev and prod | CI runs the new suites on `dist/index.js` after the dev pass |
| Access-matrix tests named from a lazy path crashed at definition time | Path callbacks read ids that only exist after `before()` | Test names derived from the callback source, ids resolved at run time | `expectAccess` helper in `test/integration/support/api.ts` |
| Removing a guard might go unnoticed | Suites only proved the happy path and a few denials | `npm run test:access-mutation` weakens five guards and requires the matching suite to fail | Add an entry whenever a guard is added (`docs/engineering/testing.md`) |
| CI browser journeys hit the Vite dev server instead of the production build | `kill $!` on `npm run dev` stops the npm wrapper only; the child kept port 5055, the production server could not bind and the readiness probe still answered | Stop steps free the port (`fuser -k`) and fail if it still serves | Console/network diagnostics printed on failure; the stop step asserts the port is free |

## 2026-10-07 — Blank page after lazy-loading pages (RM-014)

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| RM-014 was merged with `tsc`, unit tests and `vite build` green, but the dev app rendered a blank page (`Cannot access 'lazy' before initialization`) | The scripted edit inserted `const X = lazy(...)` lines between `import` statements, before the import that provides `lazy`; no browser run was done | Imports moved above the `lazy` declarations | `test/e2e/error-messages.e2e.py` (login error, invite error, lazy routes, `pageerror` and console errors fail the run) is part of CI; any UI-visible change is checked in a browser before delivery |

Generalised lesson: a green build does not prove the UI renders. Run the browser journey for every client change.

## 2026-10-08 — Mentor e2e stale after the roadmap page was scoped to one roadmap

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| `mentor-learner.e2e.py` timed out waiting for `card-week-<id>` on a reused database | The page shows one active roadmap (first listed, or last stored); the test assumed the mentor's page listed the new roadmap. Repeated runs also exhausted the in-memory auth limiter (20 per 15 minutes), turning later runs into 429 failures | `open_roadmap` opens `/roadmap?roadmap=<id>` before each week lookup; run with `RATE_LIMIT_AUTH_MAX=1000` | A UI journey must select the entity under test explicitly; when a client change scopes a view, grep the e2e suites for the old assumption |

Generalised lesson: a test that relies on "the first item in a list" breaks silently when data accumulates; address fixtures by id.

## 2026-10-13 — OTP codes exposed outside development

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| Review of the email OTP flow: codes were written to the server logs in every environment, and a deployment without `RESEND_API_KEY` reported every code as delivered | The local fallback (log the code, simulate delivery) was not gated by environment; `/api/auth/register` also bypassed email verification; `send-login` answered differently for unknown accounts | `canLogOtpCodes` / `isDirectRegistrationEnabled` (`server/security.ts`) default to development only; delivery failure returns 503; uniform `send-login` answer | `test/otp-service.test.ts` asserts the production defaults, single use, purpose binding, 5-attempt lockout and send caps |

Generalised lesson: a developer convenience that weakens a security control must be opt-in and off by default outside development, with a test on the default.

## 2026-10-13 — Stacked PRs #87-#89 merged into their stacked bases (repeat of RM-011)

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| After merging #86 to `main`, #87, #88 and #89 were merged while still targeting their parent branches; `main` only received #86 | Same as RM-011: the stacked children were not retargeted to `main` before merging, and nothing in the repository enforces it | Catch-up PR #90 (`feat/profile-notifications` → `main`), which already contains the whole stack | Repeated error, so a stronger control than a checklist: enable "Automatically delete head branches" on the repository, which makes GitHub retarget dependent PRs to `main` when their base merges; before merging a stacked PR, `gh pr view <n> --json baseRefName` must print `main` |

Generalised lesson: a rule that relies on remembering an order fails twice; turn it into a platform setting.
