# 2026-10-08 — Multi-upload des preuves et vérification de type réel

- `main` après PR #74 : `2917d0d`.
- Les multiples tâches de la même semaine partageaient `id="screenshot-upload"`. Le `label htmlFor` ciblait potentiellement le premier uploader pour les autres tâches. `ScreenshotUploader` utilise désormais `useId()` et un test ID contextualisé par tâche.
- La route de stockage validait le MIME déclaré sans vérifier les octets. Une requête annonçant `image/png` pouvait transmettre du texte HTML/SVG et être persistée. Vérification de signature PNG/JPEG/WebP/GIF avant l'écriture (contrôle de premier niveau, ne garantit pas le décodage complet).
- Test API : SVG présenté comme PNG renvoie 415 et ne crée aucun fichier.
- Playwright : deux tâches, deux inputs distincts, correspondance des labels, upload d'une tâche sans validation de l'autre, puis deux preuves persistées.
- Aucune configuration Render, R2 ou Resend modifiée. La recette du bucket R2 réel reste ouverte.

---

## Passation précédente

# 2026-10-08 — R2 / S3 : upload conditionnel et propriétaire défini à la création

- Après fusion de la PR #73, `main` est au commit `d5e9c11`.
- Les uploads directs exigent la politique de propriétaire privé dès le début.
- **S3/R2 :** `PutObject` unique avec `IfNoneMatch: "*"` (création seulement si objet absent) et métadonnées `aclpolicy` dans la même opération. Plus de HEAD-then-PUT ni de CopyObject obligatoire après upload.
- **Filesystem :** écriture exclusive (`wx`), sauvegarde immédiate des métadonnées privées, nettoyage du fichier en cas d'échec d'écriture des métadonnées.
- Une seconde requête d'upload sur la même clé reçoit HTTP 409, sans remplacer les octets.
- Anciennes preuves directes sans métadonnées de propriétaire : adoption refusée. Le provider legacy Replit conserve sa possibilité d'association initiale.
- Tests S3 concurrents / ACL, filesystem et 409 via API ajoutés.
- Vérifier la CI et effectuer un upload réel R2 depuis Render avant mise en production ouverte. Cette PR ne change pas les secrets.

---

## Passation précédente

# 2026-10-08 — Sécurisation des preuves liées aux tâches

- PR #71 et #72 fusionnées dans `main`, dernier merge `2d6ed1f`.
- Nouvelle PR : les preuves précédemment définies `visibility: public` dans `toggle-progress` deviennent privées. Les URLs de stockage ne sont plus accessibles anonymement ni via un autre compte.
- Une nouvelle route `GET /api/tasks/:taskId/evidence/:learnerId` vérifie les permissions de l'apprenant ou du mentor du bon périmètre, avant de servir les octets.
- La lecture frontend se fait via un `fetch` authentifié et ouverture d'un Blob URL, sans JWT dans la query string.
- Validation stricte du chemin de capture (objet d'upload canonique uniquement). Cache `private, no-store`, y compris pour les captures héritées auparavant publiques. Tests d'intégration multi-comptes ajoutés.
- **Recette réelle à faire** : authentification Render, screenshot upload vers R2, lecture apprenant et mentor, refus anonyme/hors périmètre. La CI n'utilise pas un vrai bucket R2.

---

## Archive

# 2026-10-08 — Vérification du moteur Python en navigateur

- Base : PR #70 fusionnée, `main` au commit `d801e43`, CI verte.
- Régression observée dans le code : `PythonProvider lazy` diffère le démarrage du worker, alors que le bouton « Exécuter » est bloqué sur `!isReady` ; aucune exécution n'est possible. Retrait du chargement différé.
- CSP de production : autorisation limitée à `https://cdn.jsdelivr.net` pour les scripts importés par le worker et les téléchargements WASM/stdlib du Pyodide `0.26.2` utilisé par `react-py@1.11.7`.
- Test Playwright de production (nouveau) : vraie exécution Python dans Chromium, assertions, re-test après modification, soumission et traçabilité `CLIENT_UNVERIFIED`. Cet essai télécharge réellement Pyodide et nécessite une connexion CDN dans la CI.
- Validations ultérieures : test sur l'URL de production Render avec les véritables secrets configurés, et recette Cloudflare R2 réelle.

---

## Passation précédente (archive)

# État courant — 2026-10-08 (labs + CI frontend)

- PR #69 fusionnée sur `main` au commit `4264c2b` ; les six jobs CI de la PR sont passés.
- Lot en cours : `fix/labs-execution-trust-frontend-ci`. Les résultats Python sont explicitement non vérifiés côté serveur (sans migration), le mentor en est averti, l'apprenant doit relancer après avoir modifié son code ; les changements frontend lancent désormais aussi le job d'intégration et les tests navigateur.
- **Ne pas confondre revue humaine et vérification serveur** : même après approbation du mentor, la sortie soumise reste `CLIENT_UNVERIFIED`.
- À valider sur une vraie instance : CDN/moteur Python en production, Resend avec domaine et clé API valides, preuve R2 de bout en bout. La CI seule ne prouve pas ces opérations.

---

## Archive

# État courant — 2026-10-08 (correctifs de recette, PR en préparation)

- Branche `fix/rm-production-r2-resend-alignment` : l'upload direct applicatif doit fonctionner avec les adaptateurs filesystem **et** S3/R2. Le contrôle de propriété ACL introduit par la PR #68 est conservé ; tests ajoutés pour le chemin S3 et les permissions.
- `render.yaml`, `.env.*.example`, README et guide de déploiement harmonisés avec Resend HTTPS (`RESEND_API_KEY`, `MAIL_FROM` vérifié). Aucun secret intégré au dépôt.
- **À valider sur le vrai service** : variable Resend et domaine vérifié ; invitation e-mail reçue ; upload + téléchargement R2 ; `/health/ready` ; alertes et sauvegardes. Ces vérifications ne sont pas couvertes par un simple pipeline CI.
- CI à vérifier sur la PR, puis poursuivre les labs Python (validation de résultats non fiable côté client), l'intégration frontend, la protection `main` et l'assainissement du backlog Terraform historique.
- PR #54, #57, #59, #60 et #68 sont fusionnées dans `main` au 8 octobre.

---

## Archive de passation du 7 octobre (historique ; les statuts de PR ci-dessous peuvent être obsolètes)

### Passation — 2026-10-07

## Objectif en cours
Enchaîner `docs/backlog.md`. Fusionnés : RM-020 (#54), RM-015 (#55), RM-014 (#56). RM-017 partiel (logs structurés + `x-request-id`) dans la PR #57 (`feat/rm-017-request-logging`), **à fusionner par l'utilisateur**. Suite : RM-016 (Terraform, choix du fournisseur à trancher) puis reste de RM-017.

## Fait
- Neon : projet `roadmapmentor` (id `morning-cloud-36713070`, org `org-super-frog-29435491`, `aws-eu-central-1`), migrations appliquées (23 tables). R2 activé ; bucket `roadmapmentor-proofs` créé (compte Cloudflare `28007ba3301ed34cfeb04c2a19b68e9f`, endpoint `https://28007ba3301ed34cfeb04c2a19b68e9f.r2.cloudflarestorage.com`). Reste manuel : jeton API R2 limité au bucket (clé + secret), service Render (Blueprint) + secrets. `DATABASE_URL` : `neon connection-string --project-id morning-cloud-36713070 --org-id org-super-frog-29435491`. Outillage : `neonctl`/`wrangler` installés, `.mcp.json` (Neon + Cloudflare), skills dans `.claude/skills` (non commités).
- RM-017 (procédures) : `docs/engineering/runbook.md` (sondes/alertes à configurer, incident, restauration Neon, rotation des secrets) sur `infra/render-deploy` (PR #60). Métriques agrégées et alertes automatisées non faites. PR #57 et #58 fusionnées ; #59 ouverte.
- Arbre de travail : modifications labs non commitées (Codex) sur cette branche, volontairement exclues du commit : ne pas les mélanger.
- RM-016 (voie gratuite) : `render.yaml` (Blueprint Docker, plan free, migrations au démarrage, R2 via l'adaptateur S3, secrets `sync: false`) + guide « Render + Neon + R2 » dans `docs/deployment.md`. **Non déployé** : aucun compte Render/Neon/R2 touché par Claude. Le projet Vercel existant (`roadmap-mentor`, dernier déploiement 11/2025) est périmé et inadapté (serveur Express + scheduler).
- Test navigateur (dev et build prod) des messages d'erreur, pages lazy et fond WebP : `test/e2e/error-messages.e2e.py` (en CI). Il a révélé un bug de RM-014 (imports après les `lazy`, page blanche en dev), corrigé dans `App.tsx`. PR #59 = reprise de #58 (mal ciblée), à fusionner.
- Messages d'erreur HTTP (branche `feat/http-error-messages`, empilée sur #57) : `server/http/errorCatalog.ts` (code + message FR), `errorEnvelope` (ajoute `code`/`message`/`requestId` à toute erreur `/api`, `error` inchangé), 404 JSON des routes `/api` inconnues, JSON mal formé/413, `ApiError` côté client, 500 sans fuite de `error.message`. Doc dans `docs/engineering/observability.md`. 102 unitaires, 126 intégration.
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

## Décision
- Stockage des preuves : Cloudflare R2 retenu (API S3, `OBJECT_STORAGE_S3_ENDPOINT`) ; fournisseur de calcul à trancher (conseillé : Fly.io/Render + Neon) pour RM-016.

## Reste à faire
0. Déploiement Render (action de l'utilisateur) : créer Neon + bucket R2 + Blueprint Render + pinger (voir `docs/deployment.md`), puis vérifier `/health/ready`, une connexion, un envoi de preuve vers R2 et un rappel planifié. **Faire tourner les secrets vus à l'écran** (clé IA, mot de passe SMTP, JWT_SECRET) et vérifier que `.env` reste hors Git.
1. Fusionner la PR #60 (#57 et #58 déjà fusionnées ; #59 à vérifier), puis `git checkout main && git pull`.
2. RM-016 : choix fait (Render gratuit + Neon + R2, pas de Terraform payant) ; `infra/terraform` (AWS) devient hors périmètre : à arbitrer/documenter. Puis finir RM-017 (métriques, alertes automatisées ; le runbook est fait).
3. RM-012 (S3) non testé sur vrai bucket/MinIO. RM-010 : mesure des requêtes, pagination, N+1 du scheduler. RM-011 : reprise d'un lot interrompu.
4. Non testé en navigateur : labs (Python), sélecteur de roadmap, redirection 401.
5. Branches distantes fusionnées à supprimer sur origin si souhaité.

## Pièges / contexte
- Test local : réseau Docker `n`, postgres (alias `postgres`, port 54329) + `ghcr.io/neondatabase/wsproxy` (port 54330) ; conteneurs `pg` et `wsp` (si Docker redémarre : `docker start pg wsp`). Sous Git Bash, `MSYS_NO_PATHCONV=1` pour `docker exec/cp` avec chemins `/x`.
- Env : `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:54330/v1 DATABASE_WS_PROXY_INSECURE=true JWT_SECRET=x OBJECT_STORAGE_PROVIDER=filesystem`, puis `npm run db:migrate`, serveur `PORT=5055 NODE_ENV=development RATE_LIMIT_AUTH_MAX=1000 RATE_LIMIT_INVITATION_MAX=1000 npx tsx server/index-dev.ts`, tests `TEST_BASE_URL=http://localhost:5055 npx tsx --test test/integration/*.integration.ts` (126 attendus), unitaires `npm test` (102).
- Parcours navigateur en local sans réseau : Google Fonts bloque l'événement `load` ; lancer Playwright avec `--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9`.
- Nouvelle migration : `DATABASE_URL=postgresql://x:x@localhost/x npx drizzle-kit generate --name=...`.
- Les écritures de gros fichiers par heredoc shell échouent parfois : préférer Edit/Write.
- Codex peut retravailler en parallèle dans le même dossier : vérifier `git status` avant de commencer.
- Pas de mention d'IA dans commits, PR ni code.
- Architecture : routes dans `server/routes/<domaine>.ts`, accès dans `server/access/`, données dans `server/data/<agrégat>.ts` (façade `server/storage.ts`), erreurs métier dans `server/domain/errors.ts`.
- Mentors de test : `ensureMentor` (script create-mentor, mot de passe 12+ caractères) ; `mentor@test.com` n'existe qu'en dev.
- Windows : pas de `pkill` ; tuer le serveur de test via `netstat -ano | grep :5055` puis `taskkill //PID <pid> //F //T`.
- **Mettre à jour PASSATION.md systématiquement à chaque PR/fin de tâche**, sans qu'on le demande.
- **Tester dans le navigateur (Playwright, dev puis build prod) tout changement visible côté client avant de livrer** ; ne jamais lister cela comme « reste à faire ».
- Une PR empilée dont la base est déjà fusionnée n'atteint pas `main` : toujours vérifier `git log main` / `ls` après la fusion.
- Codex modifie `docs/backlog.md` et `test/http-hardening.test.ts` sans les commiter : ne pas les inclure (`git stash` avant de changer de branche).
