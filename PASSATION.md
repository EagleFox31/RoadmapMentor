# Passation — 2026-10-07

## Objectif en cours
Enchaîner la feuille de route `docs/backlog.md` : RM-012, RM-009, RM-013, RM-007 fusionnés (#50 à #53). RM-020 implémenté dans la PR #54 (branche `feat/rm-020-invitations`, CI verte), **en attente de fusion par l'utilisateur** (le merge automatique a été refusé).

## Fait
- RM-020 (PR #54, non fusionnée) : table `invitations` (migration `0005`, additive), `server/data/invitations.ts`, `server/services/{invitations,invitationTokens}.ts`, `server/routes/invitations.ts`, `GoneError` (410 + `reason`), limiteur `invitation` (`RATE_LIMIT_INVITATION_*`), `INVITATION_TTL_HOURS` (72 h), page `/invite/:token`, liste d'invitations et bouton « Inviter par e-mail » sur `/roadmaps`. Tests : 95 unitaires, 126 intégration (23 nouveaux), `test/e2e/invite.e2e.py` (ajouté à la CI). SMTP réel non testé ; `docs/backlog.md` déjà à jour.
- RM-007 (PR #53 fusionnée) : `test/integration/support/api.ts` (helpers, `expectAccess`), suites weeks-crud/sessions/change-requests/billing, E2E `test/e2e/{learner,mentor}.e2e.py`, job CI `integration`, `scripts/access-mutation-check.ts`, `docs/engineering/testing.md`.
- RM-013 (PR #52) : `server/routes.ts` délègue à `server/routes/<domaine>.ts` ; `server/storage.ts` (façade) délègue à `server/data/<agrégat>.ts` ; `server/services/billingPeriods.ts`, `server/http/errors.ts` + `server/domain/errors.ts`.
- RM-002/003/004/005/006/008 : fusionnés (PR #38 à #46). RM-009 réintégré par la PR #51.
- RM-010 (#47) : `getWeekContentsByWeekIds`, route `GET /api/weeks` groupée ; `toggleTaskProgress` = upsert atomique ; migration `0002`.
- RM-011 (#48/#49) : `server/scheduler.ts`, `schedulerConfig.ts`, `jobRuns.ts` ; table `scheduled_job_runs` (migration `0003`) ; variables `SCHEDULER_*`.
- RM-018 (labs, Codex) : fusionné, migration `0004_labs.sql`.

## Décisions prises
- Un seul worktree, branches classiques dans le dossier principal.
- Pour des PR empilées, recibler sur `main` avant de fusionner la base.
- Lot de rappels idempotent par créneau ; un lot en échec n'est pas rejoué.
- RM-020 : un renvoi fait tourner le jeton ; invitation en attente relancée = idempotente ; e-mail d'un mentor refusé (409) ; envoi non journalisé dans `email_notifications` (suivi par `send_count`/`last_sent_at`). `attachLearner` du service n'est pas encore réutilisé par la route `POST /api/roadmaps/:id/mentorships` (duplication légère).

## Reste à faire
1. Fusionner la PR #54 (action de l'utilisateur), puis `git checkout main && git pull`.
2. Choisir la suite dans `docs/backlog.md` (RM-014/015/016/017). RM-012 (S3) non testé sur vrai bucket/MinIO.
3. RM-010 restant : mesure du nombre de requêtes, pagination, N+1 du scheduler de rappels.
4. RM-011 restant : métriques (RM-017), reprise d'un lot interrompu.
5. Non testé en navigateur : labs (Python), sélecteur de roadmap, redirection 401, CSP en build prod.
6. Branches distantes fusionnées à supprimer sur origin (feat/rm-0xx, fix/rm-005-prod-deps) si souhaité.

## Pièges / contexte
- Test local : réseau Docker `n`, postgres (alias `postgres`, port 54329) + `ghcr.io/neondatabase/wsproxy` (port 54330) ; conteneurs `pg` et `wsp` (si Docker redémarre : `docker start pg wsp`). Sous Git Bash, `MSYS_NO_PATHCONV=1` pour `docker exec/cp` avec chemins `/x`.
- Env : `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:54330/v1 DATABASE_WS_PROXY_INSECURE=true JWT_SECRET=x OBJECT_STORAGE_PROVIDER=filesystem`, puis `npm run db:migrate`, serveur `PORT=5055 NODE_ENV=development RATE_LIMIT_AUTH_MAX=1000 RATE_LIMIT_INVITATION_MAX=1000 npx tsx server/index-dev.ts`, tests `TEST_BASE_URL=http://localhost:5055 npx tsx --test test/integration/*.integration.ts` (126 attendus), unitaires `npm test` (95).
- Parcours navigateur en local sans réseau : Google Fonts bloque l'événement `load` ; lancer Playwright avec `--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9`.
- Nouvelle migration : `DATABASE_URL=postgresql://x:x@localhost/x npx drizzle-kit generate --name=...`.
- Les écritures de gros fichiers par heredoc shell échouent parfois : préférer Edit/Write.
- Codex peut retravailler en parallèle dans le même dossier : vérifier `git status` avant de commencer.
- Pas de mention d'IA dans commits, PR ni code.
- Architecture : routes dans `server/routes/<domaine>.ts`, accès dans `server/access/`, données dans `server/data/<agrégat>.ts` (façade `server/storage.ts`), erreurs métier dans `server/domain/errors.ts`.
- Mentors de test : `ensureMentor` (script create-mentor, mot de passe 12+ caractères) ; `mentor@test.com` n'existe qu'en dev.
- Windows : pas de `pkill` ; tuer le serveur de test via `netstat -ano | grep :5055` puis `taskkill //PID <pid> //F //T`.
