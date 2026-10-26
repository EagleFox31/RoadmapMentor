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

## 2026-10-13 — OTP error messages replaced by a generic 400 in production

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| Signing up with an email that already has an account showed "La requête est invalide" instead of the explicit message | `errorEnvelope` maps the English `error` through `describeError`; the OTP routes return French messages with no `code`, so they fell back to the generic status message (also hid OTP lockout, expiry and 503 delivery messages) | `userError(code, message)` in `server/http/errorCatalog.ts`; every French auth error now carries an explicit code | `test/observability.test.ts`: the envelope keeps `userError` messages, and a guard fails if `server/routes/auth.ts` sends a French `error` without a code |

Generalised lesson: a response post-processor is part of the contract; a new route must be tested through it, not only at the handler.

## 2026-10-13 — Session token accepted in the query string (near miss)

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| Opening a mentor-uploaded document from a link needed authentication, so `authMiddleware` was changed to read `?token=` and the client appended the JWT to the link (never merged) | A plain `<a href>` cannot send `Authorization`; the shortcut put a long-lived, full-account token in URLs (browser history, server logs, Referer). The stored-document route also served any object to any signed-in user | Documents are read through `/api/resources/:id/document` and `/api/resources/:id/pdf` (week access rules); the client fetches with `Authorization` and opens a blob (`client/src/lib/openAuthorizedFile.ts`); the stored link is readable by its uploader only | `test/auth.test.ts`: a query-string token is refused (401); `test/resource-links.test.ts`: uploaded documents are recognized by path on any host |

Generalised lesson: protected files are opened by an authenticated fetch plus a blob URL, never by putting a credential in a link.

## 2026-10-13 — PR #96 red in CI on the bundle budget

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| The `integration` job of #96 (pdf.js preview) failed at `npm run check:bundle`: `pdf-*.js` 472 kB > 400 kB | pdf.js is a single vendor module that cannot be split further; it is already loaded through a dynamic import, but the budget applied the initial-chunk limit to every chunk. `check:bundle` was not run before pushing | Declared, justified exception in `scripts/check-bundle-budget.mjs` (`exceptions`: `pdf-*.js`, own 520 kB ceiling, `BUDGET_PDFJS_KB`); every other chunk keeps 400 kB | Run `npm run build && npm run check:bundle` before pushing any change that adds a front-end dependency; a lazy vendor chunk gets an explicit exception entry, never a global budget increase |

Generalised lesson: a budget is a contract; exceed it through a named, bounded exception, not by loosening the global limit.

## 2026-10-14 — Open tab kept running the previous build after a deploy

| Context | Root cause | Resolution | Prevention |
| --- | --- | --- | --- |
| A learner opened a resource and it was never marked as consulted: the server received no `PUT /consultation` at all | The tab had been loaded before the container was rebuilt and still ran the old JS (without automatic marking). The session stayed valid, so nothing told the user; `staleTime: Infinity` and no window-focus refetch meant the tab never contacted the new server on return | Each build carries an id (`<meta name="app-build">`, `APP_BUILD_ID` or random); the server sends it as `X-App-Build` on every `/api` response and on `GET /api/app-build`; the client shows a top banner with a visible 30 s countdown ("Mettre à jour maintenant" / "Plus tard", one 10 min deferral), paused while the tab is hidden or a dialog, draft, upload or mutation is in progress; never a silent reload; `vite:preloadError` reloads once | `test/app-build.test.ts` (id parsing, stale decision, header on `/api`); browser scenario with a simulated clock: countdown, pause on draft and hidden tab, deferral, reload onto the new build, no reload loop |

Generalised lesson: after a deploy, check whether open clients run the code you think they run before debugging the feature; a valid session says nothing about the version of the client.
