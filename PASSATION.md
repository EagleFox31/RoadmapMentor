# Passation — 2026-10-07

## Objectif en cours
Enchaîner `docs/backlog.md`. Fusionnés : RM-020 (#54), RM-015 (#55), RM-014 (#56). RM-017 partiel (logs structurés + `x-request-id`) dans la PR #57 (`feat/rm-017-request-logging`), **à fusionner par l'utilisateur**. Suite : RM-016 (Terraform, choix du fournisseur à trancher) puis reste de RM-017.

## Fait
- RM-016 (voie gratuite) : `render.yaml` (Blueprint Docker, plan free, migrations au démarrage, R2 via l'adaptateur S3, secrets `sync: false`) + guide « Render + Neon + R2 » dans `docs/deployment.md`. **Non déployé** : aucun compte Render/Neon/R2 touché par Claude. Le projet Vercel existant (`roadmap-mentor`, dernier déploiement 11/2025) est périmé et inadapté (serveur Express + scheduler).
- RM-014 (#56) : fond WebP 29 kB, pages en `React.lazy`, bundle initial 281 kB, `npm run check:bundle` (budgets JS 400/CSS 150/média 500 kB) + étape CI.
- RM-017 partiel (#57) : `server/http/observability.ts` (`requestId`, `accessLog`, `logEvent`), 500 avec `requestId`, `docs/engineering/observability.md`, test `test/observability.test.ts`. Reste : métriques, alertes, procédures (dépend de RM-016).
- RM-015 (#55) : dépendances inutiles retirées, `nanoid` déclaré.
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
0. Déploiement Render (action de l'utilisateur) : créer Neon + bucket R2 + Blueprint Render + pinger (voir `docs/deployment.md`), puis vérifier `/health/ready`, une connexion, un envoi de preuve vers R2 et un rappel planifié. **Faire tourner les secrets vus à l'écran** (clé IA, mot de passe SMTP, JWT_SECRET) et vérifier que `.env` reste hors Git.
1. Fusionner la PR #57 puis `git checkout main && git pull`.
2. RM-016 : choix fait (Render gratuit + Neon + R2, pas de Terraform payant) ; `infra/terraform` (AWS) devient hors périmètre : à arbitrer/documenter. Puis finir RM-017 (métriques, alertes, procédures).
3. RM-012 (S3) non testé sur vrai bucket/MinIO. RM-010 : mesure des requêtes, pagination, N+1 du scheduler. RM-011 : reprise d'un lot interrompu.
4. Non testé en navigateur : labs (Python), sélecteur de roadmap, redirection 401, CSP en build prod, chargement des pages lazy et fond WebP (RM-014).
5. Branches distantes fusionnées à supprimer sur origin si souhaité.

## Pièges / contexte
- Test local : réseau Docker `n`, postgres (alias `postgres`, port 54329) + `ghcr.io/neondatabase/wsproxy` (port 54330) ; conteneurs `pg` et `wsp` (si Docker redémarre : `docker start pg wsp`). Sous Git Bash, `MSYS_NO_PATHCONV=1` pour `docker exec/cp` avec chemins `/x`.
- Env : `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:54330/v1 DATABASE_WS_PROXY_INSECURE=true JWT_SECRET=x OBJECT_STORAGE_PROVIDER=filesystem`, puis `npm run db:migrate`, serveur `PORT=5055 NODE_ENV=development RATE_LIMIT_AUTH_MAX=1000 RATE_LIMIT_INVITATION_MAX=1000 npx tsx server/index-dev.ts`, tests `TEST_BASE_URL=http://localhost:5055 npx tsx --test test/integration/*.integration.ts` (126 attendus), unitaires `npm test` (98).
- Parcours navigateur en local sans réseau : Google Fonts bloque l'événement `load` ; lancer Playwright avec `--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9`.
- Nouvelle migration : `DATABASE_URL=postgresql://x:x@localhost/x npx drizzle-kit generate --name=...`.
- Les écritures de gros fichiers par heredoc shell échouent parfois : préférer Edit/Write.
- Codex peut retravailler en parallèle dans le même dossier : vérifier `git status` avant de commencer.
- Pas de mention d'IA dans commits, PR ni code.
- Architecture : routes dans `server/routes/<domaine>.ts`, accès dans `server/access/`, données dans `server/data/<agrégat>.ts` (façade `server/storage.ts`), erreurs métier dans `server/domain/errors.ts`.
- Mentors de test : `ensureMentor` (script create-mentor, mot de passe 12+ caractères) ; `mentor@test.com` n'existe qu'en dev.
- Windows : pas de `pkill` ; tuer le serveur de test via `netstat -ano | grep :5055` puis `taskkill //PID <pid> //F //T`.
- **Mettre à jour PASSATION.md systématiquement à chaque PR/fin de tâche**, sans qu'on le demande.
