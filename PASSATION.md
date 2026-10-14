# Passation — 2026-10-14

## Objectif en cours
Remplacer le rechargement silencieux des onglets périmés après un déploiement par un bandeau en haut de page avec compte à rebours, puis livrer la branche `feat/notifications-deadlines-keepalive` pour la mise en service du binôme Jennifer / Pavel sur `roadmapmentor.trigenys.com`.

## Fait
- Prod Render + Neon : OTP Resend OK, mentor Jennifer (userId=2), roadmap de Pavel importée (roadmapId=1), domaine personnalisé. #91 à #96 fusionnées.
- Branche (commitée) : keep-alive Cloudflare (`infra/keepalive-worker/`), notifications semaine/étapes/échéances, documents téléversés servis par `/api/resources/:id/document|pdf` (fetch authentifié puis blob), refonte UI de la roadmap, e-mails sur le gabarit OTP.
- Détection de nouvelle version **commitée** (57ce81a) : bandeau fixe en haut avec compte à rebours de 30 s (`AppUpdateBanner` dans `client/src/lib/appBuild.tsx`, monté dans `main.tsx`), pause (onglet masqué, dialogue, brouillon, fichier, mutation), « Plus tard » = report unique de 10 min, aucun rechargement silencieux.
- Vérifié : `npm test` (156/0), `tsc`, build, `check:bundle`, Docker, Playwright avec horloge simulée (`stale_banner.py` dans le scratchpad, non versionné).
- **PR #98 ouverte** : https://github.com/EagleFox31/RoadmapMentor/pull/98

## Décisions prises
- Onglet périmé = la session est valide, seul le JS est ancien : **jamais de déconnexion** (perte de saisie, nouvel OTP, ne couvre pas l'onglet resté au premier plan).
- Le rechargement doit être **visible et annoncé** : un rechargement à l'insu de l'utilisateur fait perdre sa position et l'état de la page.
- Exception : `vite:preloadError` (morceau de JS supprimé) recharge immédiatement, une seule fois, car la page est déjà cassée.
- Un seul rechargement automatique par build (`sessionStorage`), pour éviter toute boucle.
- Jamais de jeton de session dans une URL. Import de roadmap idempotent. « Consultée » = ouverte depuis l'app.

## Reste à faire
1. Attendre la CI de la PR #98 au vert, puis l'utilisateur fusionne.
2. Render :
   - `APP_URL=https://roadmapmentor.trigenys.com` ;
   - `APP_BUILD_ID` = SHA du commit si possible ;
   - vérifier `OBJECT_STORAGE_PROVIDER`.
3. Jennifer valide la semaine 1. Inviter Pavel avec **sa** propre adresse. Vérifier que `support@trigenys.com` existe.

## Pièges / contexte
- **Travail non commité d'un autre agent** dans le dossier : `client/src/App.tsx`, `client/src/pages/roadmap-page.tsx`, `client/src/components/bottom-bar.tsx`, `client/src/components/week-strip-mobile.tsx`, `docs/walkthrough-gemini.md`. Ne pas le commiter ni l'écraser.
- Conteneur local actuel construit avec `APP_BUILD_ID=e2e-…` et embarquant ce travail. Pour tester un nouveau build : `docker compose build app --build-arg APP_BUILD_ID=<id>` puis `docker compose up -d app` (sans changement de code et sans argument, le cache Docker garde le même identifiant).
- Simuler un retour sur l'onglet en Playwright : redéfinir `document.visibilityState`, puis dispatcher `visibilitychange`.
- Bug « rien ne se passe » côté client après un `docker compose up` : d'abord vérifier l'ancien build (logs `docker logs roadmapmentor-app-1`, Ctrl+Shift+R).
- Compte de test apprenant local : Darren (userId=29, semaine 42).
- Le `.env` local pointe sur la **base de prod**. En local, surcharger `DATABASE_URL` vers le Postgres Docker (proxy wsproxy, voir `docs/`).
- Dépôt **public** : aucun secret ni aucune adresse personnelle. Avant un push front : `npm run build && npm run check:bundle`. Réseau lent : `timeout 120 git push`.
- `git checkout -- test/e2e/__pycache__` après les E2E. Dérive Drizzle : `npx drizzle-kit generate` doit répondre « No schema changes ».
- `gh pr merge` refusé côté outil : c'est l'utilisateur qui fusionne. Vocabulaire : « andragogie », jamais « pédagogie ».
