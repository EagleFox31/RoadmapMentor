# Passation — 2026-10-13

## Objectif en cours
Mise en service de l'app en prod pour un premier binôme : Jennifer Aka'a (mentore) et Pavel (apprenant), sur le domaine `roadmapmentor.trigenys.com`.

## Fait
- Prod (Render + Neon) :
  - OTP e-mail réel via Resend, recette OK ;
  - mentor Jennifer créé (userId=2, `npm run mentor:create`).
- Roadmap de Pavel préchargée en prod : roadmapId=1, 9 étapes, 33 ressources, vérifiée dans le navigateur.
  - Commande `npm run roadmap:import` : `scripts/import-roadmap.ts`, `server/domain/roadmapImport.ts`, `test/roadmap-import.test.ts`, doc `docs/deployment.md` « Roadmap import ».
  - Fichier source hors dépôt : `C:\Users\lawry\Documents\Mentoring\roadmap-shopflow-complete.json`.
- PR ouvertes, toutes à fusionner (merge commit) :
  - **#91** `fix/otp-error-messages` : messages OTP français conservés par `errorEnvelope` (helper `userError`, `server/http/errorCatalog.ts`) ;
  - **#92** `feat/roadmap-import` : commande d'import, walkthrough `docs/walkthrough-roadmap-import.md`, PASSATION ;
  - **#93** `feat/auto-consult-resource` : ouvrir une ressource la marque « consultée » (`client/src/components/resources-list.tsx`, helper `markOpened`) ;
  - **#94** `fix/invite-mentor-email-message` : message explicite quand on invite l'e-mail d'un compte mentor (`server/http/errorCatalog.ts:39`).
- E-mail d'invitation à l'identité du mail OTP (gabarit commun `server/services/emailLayout.ts`, templates `server/services/emailTemplates.ts`) : PR `feat/branded-invitation-email`.
- Domaine personnalisé `roadmapmentor.trigenys.com` ajouté sur Render : vérifié, certificat en cours d'émission.
- Mail OTP relu (rendu sans envoi) : liens basés sur `APP_URL`, expéditeur `roadmapmentor@trigenys.com`.

## Décisions prises
- Import idempotent par titre, parmi les roadmaps du mentor :
  - absente → création ;
  - vide → remplissage ;
  - avec semaines → aucune écriture, pour ne jamais écraser les modifications du mentor.
- La roadmap prod fusionne deux sources :
  - semaines 1 à 4 tirées de `Pavel_Mois1_Final` (28 ressources) ;
  - mois 2 à 6 tirés de la roadmap locale n°31 (autre agent) ;
  - titre identique à la n°31.
- Les dates de la roadmap commencent le 2026-10-12 ; elles se modifient dans l'interface.
- « Consultée » signifie « ouverte depuis l'app ». La lecture sur le site externe n'est pas mesurable. Le bouton manuel est gardé pour annuler.
- Un compte MENTOR ne peut jamais être rattaché comme apprenant (`server/services/invitations.ts:52`).

## Reste à faire
1. Render → Environment : `APP_URL=https://roadmapmentor.trigenys.com`. Sinon les liens d'invitation et d'e-mail pointent vers onrender.
2. Fusionner #91, #92, #93 et #94. #92 et la PR suivante modifient tous deux PASSATION.md : résoudre le conflit en gardant ce fichier.
3. Jennifer doit cliquer « Valider » au moins sur la semaine 1 en prod : un apprenant ne voit que les semaines validées (`server/routes/weeks.ts:42`).
4. Inviter Pavel avec **sa** propre adresse. `justsmilewithme242@gmail.com` est déjà le compte mentor n°1 en prod.
5. Vérifier que `support@trigenys.com` existe : le pied du mail OTP pointe dessus.
6. Proposée, en attente d'accord : adopter Release Please (`reusable-release.yml` d'appfactory-project-automation).
7. Options :
   - `--publish=1-4` sur `roadmap:import` pour valider des semaines dès l'import ;
   - `--dry-run` ;
   - retirer le préfixe « 400: » des toasts.
8. Vérifier en navigateur réel les modales et le lecteur YouTube (noir en headless). E2E Playwright du flux OTP.
9. RM-021 tarification (`docs/mentor-pricing.md`). AWS #27/#28 différés (issue #25).
10. Fichiers non commités d'un autre agent : `client/src/components/week-selector.tsx`, `attached_assets/week-bg-*.jpg`, `docs/walkthrough-gemini.md`, `server/auth.ts` (casse 7 tests authMiddleware), `server/routes/content.ts`, `shared/resourceLinks.ts`, `infra/keepalive-worker/`. À valider ou à jeter par l'utilisateur ; ne pas les inclure dans une PR sans accord.

## Pièges / contexte
- Le `.env` local pointe sur la **base Neon de prod**. Pour les scripts locaux, surcharger :
  - `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor`
  - `DATABASE_WS_PROXY=localhost:5480/v1`
  - `DATABASE_WS_PROXY_INSECURE=true`
  - avec le proxy : `docker run -d --rm --name rm-wsproxy-tmp --network <réseau compose> -p 5480:80 -e ALLOW_ADDR_REGEX='.*' ghcr.io/neondatabase/wsproxy:latest`.
- Scripts en prod : exporter `DATABASE_URL` et `JWT_SECRET` depuis `roadmapmentor.env` (ignoré, ne jamais committer), avec `NODE_ENV=production`. Masquer l'URL dans les sorties.
- En local, la semaine 1 de la roadmap n°31 a été validée pour tester avec l'apprenant Darren (userId=29).
- Le `.env` local contient une vraie `RESEND_API_KEY`. Pour ne pas envoyer de vrais mails : `RESEND_API_KEY= docker compose up -d app`.
- Le client saute l'OTP pour les e-mails en `.test`. Code OTP local : `docker logs --since=60s roadmapmentor-app-1 | grep -oE "code to <email> \([^)]*\): [0-9]{6}"`.
- `test/e2e/__pycache__/*.pyc` est suivi par git : `git checkout -- test/e2e/__pycache__` après les E2E.
- Dérive Drizzle : `DATABASE_URL=postgresql://x:x@localhost:5432/x npx drizzle-kit generate --name ci_drift_check` doit répondre « No schema changes ».
- Architecture :
  - routes dans `server/routes/<domaine>.ts` ;
  - données dans `server/data/` derrière la façade `storage` ;
  - messages d'erreur dans `server/http/errorCatalog.ts`.
- `gh pr merge` est refusé côté outil : c'est l'utilisateur qui fusionne. « Auto delete head branches » est activé.
- Mettre à jour ce fichier à chaque PR. Tester dans le navigateur tout changement visible. Vocabulaire : « andragogie », jamais « pédagogie ».
