# Passation — 2026-10-06

## Objectif en cours
Enchaîner la feuille de route `docs/backlog.md` : RM-012 et RM-009 fusionnés ; RM-013 (découpage) en PR sur `refactor/rm-013-split-backend` ; prochain : RM-007 ou RM-020.

## Fait (tout est fusionné dans `main`, e8e44d5)
- RM-002/003/004/005/006/008 : fusionnés (PR #38 à #46). RM-009 (commit 3e1c052) ne l'était PAS : réintégré par la PR #51.
- RM-010 (#47) : `getWeekContentsByWeekIds` dans `server/storage.ts` + route `GET /api/weeks` groupée (`server/routes.ts`) ; `toggleTaskProgress` = upsert atomique ; migration `0002` (dédoublonnage + unique `(task_id, learner_id)` + index).
- RM-011 (#48/#49) : `server/scheduler.ts`, `server/services/schedulerConfig.ts`, `server/services/jobRuns.ts` ; table `scheduled_job_runs` (migration `0003`) ; variables `SCHEDULER_ENABLED/TIMEZONE/MIDWEEK_CRON/ENDWEEK_CRON`.
- RM-018 (labs, travail de Codex) : fusionné avec migration `0004_labs.sql`, labs et soumissions chargés par le chargeur groupé.
- Nettoyage : un seul dossier de travail `roadmapmentor`, branche `main`, plus aucun worktree ni branche locale.

## Décisions prises
- Un seul worktree, branches classiques dans le dossier principal (les worktrees multiples ont créé du désordre).
- Merge #48 parti dans la branche de #47 : récupéré par la PR #49 vers `main`. Pour des PR empilées, recibler sur `main` avant de fusionner la base.
- Lot de rappels idempotent par créneau (pas par e-mail) ; un lot en échec n'est pas rejoué.

## Reste à faire
1. Fusionner la PR RM-013. RM-012 (S3) non testé sur vrai bucket/MinIO.
4. RM-010 restant : mesure du nombre de requêtes, pagination, N+1 du scheduler de rappels.
5. RM-011 restant : métriques (RM-017), reprise d'un lot interrompu.
6. RM-007 (CRUD semaines, séances, facturation, CI), RM-020 (invitation par e-mail).
7. Non testé en navigateur : labs (Python), sélecteur de roadmap, redirection 401, CSP en build prod.
8. Branches distantes fusionnées à supprimer sur origin (feat/rm-0xx, fix/rm-005-prod-deps) si souhaité.

## Pièges / contexte
- Test local : `docker network create n`, postgres (alias `postgres`, port 54329) + `ghcr.io/neondatabase/wsproxy` (port 54330) ; sous Git Bash, `MSYS_NO_PATHCONV=1` pour `docker exec/cp` avec chemins `/x`.
- Env : `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:54330/v1 DATABASE_WS_PROXY_INSECURE=true JWT_SECRET=x OBJECT_STORAGE_PROVIDER=filesystem`, puis `npm run db:migrate`, serveur `PORT=5055 NODE_ENV=development RATE_LIMIT_AUTH_MAX=1000 npx tsx server/index-dev.ts`, tests `TEST_BASE_URL=http://localhost:5055 npx tsx --test test/integration/*.integration.ts` (26 attendus), unitaires `npm test` (78).
- Nouvelle migration : `DATABASE_URL=postgresql://x:x@localhost/x npx drizzle-kit generate --name=...`.
- Éditer les fichiers par Edit/Write ou scripts Python en heredoc `'PYEOF'` : pas de découpage `index()` sans borner la recherche après le début.
- Codex peut retravailler en parallèle dans le même dossier : vérifier `git status` avant de commencer.
- Pas de mention d'IA dans commits, PR ni code.
- Architecture : routes dans `server/routes/<domaine>.ts`, accès dans `server/access/`, données dans `server/data/<agrégat>.ts` (façade `server/storage.ts`), erreurs métier dans `server/domain/errors.ts`.
- Windows : pas de `pkill` ; tuer le serveur de test via `netstat -ano | grep :5055` puis `taskkill //PID <pid> //F //T` (un ancien serveur resté actif fausse les tests).
