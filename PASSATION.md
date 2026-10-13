# Passation — 2026-10-13

## Objectif en cours
Mise en service de l'app en prod pour le premier binôme : Jennifer (mentore) et Pavel (apprenant), sur `roadmapmentor.trigenys.com`. Il reste à fusionner la PR de `feat/notifications-deadlines-keepalive`.

## Fait
- Prod (Render + Neon) :
  - OTP Resend OK ;
  - mentor Jennifer (userId=2) ;
  - roadmap de Pavel préchargée (roadmapId=1, `npm run roadmap:import`) ;
  - domaine personnalisé ajouté.
- #91 à #96 fusionnées dans `main` (OTP, import, consultation auto, invitation mentor, e-mail d'invitation, aperçu PDF).
- Branche `feat/notifications-deadlines-keepalive`, `main` fusionnée dedans :
  - keep-alive par Worker Cloudflare (`infra/keepalive-worker/`) ;
  - notifications e-mail semaine, étapes et échéances (`server/services/milestones.ts`, `weekDeadlines.ts`, `notifyWeekLearners.ts`) ;
  - refonte des ressources et téléversement de documents par le mentor ;
  - documents servis par `/api/resources/:id/document` et `/pdf` selon l'accès à la semaine ; ouverture par fetch authentifié puis blob (`client/src/lib/openAuthorizedFile.ts`) ;
  - refonte UI de la roadmap par Gemini (lignes de tâche compactes, anneau de progression, dates lisibles), `data-testid` conservés ;
  - tous les e-mails de notification sur le gabarit OTP (`server/services/emailTemplates.ts`) ;
  - fusion : marquage auto « consultée » (#93) reporté dans la nouvelle liste de ressources ; fonds de semaine convertis en WebP 1024 px (743 kB → 38-98 kB) pour tenir le budget média.

## Décisions prises
- Jamais de jeton de session dans une URL : fichiers protégés = fetch avec `Authorization` puis blob. Test : `test/auth.test.ts`.
- Le lien enregistré d'un document téléversé n'est lisible que par son auteur. Les autres passent par la ressource.
- Aperçu PDF via pdf.js sur canvas ; chunk pdf.js sous exception de budget bornée (520 kB, `scripts/check-bundle-budget.mjs`).
- Proxy PDF : HTTPS 443 seulement, IP contrôlée à la connexion, 16 Mo, 30 s.
- Import de roadmap idempotent : aucune écriture si la roadmap a déjà des semaines.
- « Consultée » = ouverte depuis l'app ; le bouton manuel sert à annuler.

## Reste à faire
1. Fusionner la PR de `feat/notifications-deadlines-keepalive` une fois la CI au vert.
2. Render : `APP_URL=https://roadmapmentor.trigenys.com`. Pour les documents téléversés en prod, vérifier `OBJECT_STORAGE_PROVIDER` (`replit`, `filesystem` ou `s3`).
3. Jennifer valide au moins la semaine 1 (un apprenant ne voit que les semaines validées : `server/routes/weeks.ts:42`).
4. Inviter Pavel avec **sa** propre adresse : l'adresse personnelle utilisée jusqu'ici est déjà le compte mentor n°1 en prod.
5. Vérifier que `support@trigenys.com` existe.
6. En option : Release Please ; `--publish` et `--dry-run` sur l'import.

## Pièges / contexte
- Dépôt **public** : aucune adresse personnelle ni aucun secret dans les fichiers committés.
- Le `.env` local pointe sur la **base de prod**. En local, surcharger `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:5480/v1 DATABASE_WS_PROXY_INSECURE=true`, avec le proxy `docker run -d --rm --name rm-wsproxy-tmp --network roadmapmentor_default -p 5480:80 -e ALLOW_ADDR_REGEX='.*' ghcr.io/neondatabase/wsproxy:latest`.
- Serveur de prod local : `npm run build`, puis `NODE_ENV=production PORT=5001 OBJECT_STORAGE_PROVIDER=filesystem OBJECT_STORAGE_LOCAL_DIR=<dossier> RESEND_API_KEY= node dist/index.js`.
- Scripts en prod : variables depuis `roadmapmentor.env` (jamais committé), URL masquée dans les sorties.
- Avant de pousser un changement front : `npm run build && npm run check:bundle` (images en WebP).
- Réseau local très lent : utiliser `timeout 120 git push`.
- `test/e2e/__pycache__/*.pyc` est suivi : `git checkout -- test/e2e/__pycache__` après les E2E.
- Dérive Drizzle : `DATABASE_URL=postgresql://x:x@localhost:5432/x npx drizzle-kit generate --name ci_drift_check` → « No schema changes ».
- `gh pr merge` refusé côté outil : c'est l'utilisateur qui fusionne. PASSATION à mettre à jour à chaque PR. Vocabulaire : « andragogie », jamais « pédagogie ».
