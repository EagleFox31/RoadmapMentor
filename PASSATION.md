# Passation — 2026-10-13

## Objectif en cours
Fusionner la pile de 4 PR (auth OTP, UI responsive, profil/notifications, durcissement OTP) puis faire la recette en production avec un vrai envoi d'e-mail.

## Fait
- 4 PR empilées, à fusionner dans l'ordre :
  - #86 `feat/auth-otp-brand` : OTP e-mail, login, logo ;
  - #87 `feat/learner-responsive-ui` : responsive, TopBar, design system ;
  - #88 `feat/profile-notifications` : `/profile`, `/notifications`, chown Docker restreint ;
  - #89 `feat/auth-otp-hardening`.
- CI : #86, #87 et #88 au vert ; checks de #89 lancés.
- Durcissement OTP (#89) :
  - drapeaux `canLogOtpCodes` / `isDirectRegistrationEnabled` dans `server/security.ts`, actifs par défaut en développement seulement ;
  - `server/services/emailService.ts` : code loggé et envoi simulé uniquement si `OTP_LOG_CODES` est actif ;
  - `server/routes/auth.ts:20` : `/api/auth/register` renvoie 403 `DIRECT_REGISTRATION_DISABLED` hors drapeau ;
  - `server/routes/auth.ts:103,170` : 503 si l'envoi échoue, 429 si rate limit ;
  - `server/routes/auth.ts:162` : `send-login` donne une réponse uniforme (pas d'énumération de comptes) ;
  - `server/services/otpService.ts:154` : message explicite au 5e mauvais essai.
- Profil : `updateProfileSchema` strict + `limiters.auth` sur `PUT /api/auth/profile`. Notifications via `storage.listEmailNotifications`, sans `errorMessage`.
- Tests :
  - `test/otp-service.test.ts` : usage unique, finalité, verrou à 5 essais, cooldown, plafonds 3/h et 5/j, échec d'envoi, défauts des drapeaux ;
  - `test/profile-update.test.ts`.
- Vérifié :
  - `npm test` 134 pass / 0 fail ; tsc OK ; aucune dérive Drizzle ;
  - les 7 suites E2E CI passent sur le build Docker ;
  - parcours navigateur OTP (inscription puis connexion sans mot de passe) OK ;
  - verrou à 5 essais OK en réel ;
  - build prod avec drapeaux off : 403, 200 uniforme, aucun code dans les logs.
- Docs : `docs/engineering/lessons-learned.md` (entrée du 2026-10-13) et `docs/deployment.md:221`.
- 12 branches locales déjà fusionnées dans main supprimées.

## Décisions prises
- En prod, l'inscription passe obligatoirement par OTP. La CI E2E et le compose local posent `AUTH_DIRECT_REGISTRATION=true` pour garder les parcours existants.
- Sans `RESEND_API_KEY` en prod, la réponse est 503 : un succès simulé est interdit.
- Codes OTP hachés en SHA-256 et générés par `crypto.randomInt`. Rate limit : 60 s, 3/h, 5/j, 5 essais ; refus sans écriture.
- Édition/suppression de ressources toujours visibles sur mobile (pas de hover au tactile).

## Reste à faire
1. ✅ `RESEND_API_KEY` et `MAIL_FROM` posés sur Render.
2. ✅ #90 fusionnée. **PR #91** (`fix/otp-error-messages`) : les erreurs OTP françaises étaient remplacées par « 400 : requête invalide » par `errorEnvelope` → helper `userError`. À fusionner. (Historique : #86 est sur main. #87 à #89 ont été fusionnées dans leurs bases empilées (même erreur que RM-011). **Fusionner #90** (`feat/profile-notifications` → main, qui contient toute la pile, plus l'entrée lessons-learned), puis supprimer les 4 branches `feat/*`. Garde-fou : activer « Automatically delete head branches » sur le dépôt — fait.)
3. Recette prod : vrai e-mail OTP reçu, parcours authentifié complet (jamais fait en prod). Mentor Jennifer Aka'a créé en prod le 2026-10-13 (userId=2, `npm run mentor:create` avec `DATABASE_URL` et `JWT_SECRET` de `roadmapmentor.env`, `NODE_ENV=production`).
4. Vérifier en navigateur réel les modales et le lecteur YouTube (noir en headless).
5. Option : ajouter un E2E Playwright du flux OTP (lecture du code dans les logs, e-mail hors `.test`).
6. **RM-021 tarification** : plan dans [docs/mentor-pricing.md](docs/mentor-pricing.md). Branche depuis `main` après les fusions, tranche 1 seulement.
7. AWS #27/#28 différés (issue #25).
8. ✅ Roadmap de Pavel préchargée en prod pour Jennifer le 2026-10-13 : roadmapId=1, 9 étapes, 33 ressources, vérifiée dans le navigateur.
   - Commande générique `npm run roadmap:import` (PR `feat/roadmap-import`, à fusionner) ; voir `docs/deployment.md` « Roadmap import ».
   - Fichier source hors dépôt : `C:\Users\lawry\Documents\Mentoring\roadmap-shopflow-complete.json`. Les semaines 1-4 viennent de `Pavel_Mois1_Final` (28 ressources) et les mois 2-6 de la roadmap locale n°31 créée par Gemini, même titre.
   - Les dates commencent le lundi 2026-10-12 ; elles se modifient dans l'interface.
   - Ré-exécuter la commande est sans effet si la roadmap a déjà des semaines.
9. Apprenant : il ne voit que les semaines validées par le mentor (`server/routes/weeks.ts:42`). En prod, Jennifer doit cliquer « Valider » au moins sur la semaine 1 pour que Pavel voie quelque chose. En local, la semaine 1 de la roadmap n°31 a été validée pour tester avec Darren.
10. **PR #93** (`feat/auto-consult-resource`) : ouvrir une ressource la marque « consultée » (lien externe, « Lire ici », aperçu PDF). Le bouton manuel permet d'annuler. À fusionner.
11. `docs/walkthrough-gemini.md` contient une modification non commitée d'un autre agent (provisioning d'un mentor, avec un e-mail personnel). À valider ou à jeter par l'utilisateur.

## Pièges / contexte
- Le `.env` local contient une vraie `RESEND_API_KEY`. Pour ne pas envoyer de vrais mails : `RESEND_API_KEY= docker compose up -d app`.
- Le client saute l'OTP pour les e-mails en `.test`. Pour tester l'OTP, utiliser `@example.org`, puis lire le code : `docker logs --since=60s roadmapmentor-app-1 | grep -oE "code to <email> \([^)]*\): [0-9]{6}"`.
- E2E qui créent un mentor :
  - lancer le proxy `docker run -d --rm --name e2e-db-proxy --network <réseau compose> -p 5444:80 -e ALLOW_ADDR_REGEX='.*' ghcr.io/neondatabase/wsproxy:latest` ;
  - puis `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:5444/v1 DATABASE_WS_PROXY_INSECURE=true NODE_ENV=development TEST_BASE_URL=http://localhost:5000` ;
  - `docker restart roadmapmentor-app-1` entre deux suites (429).
- `mentor-learner` et `roadmaps-ui` utilisent une route dev-only (404 sur le build Docker, hors CI).
- `test/e2e/__pycache__/*.pyc` est suivi par git : après les E2E, faire `git checkout -- test/e2e/__pycache__`.
- Ne jamais committer `roadmapmentor.env` (ignoré via `*.env`).
- Dérive Drizzle : `DATABASE_URL=postgresql://x:x@localhost:5432/x npx drizzle-kit generate --name ci_drift_check` doit répondre « No schema changes ».
- Architecture :
  - routes dans `server/routes/<domaine>.ts` ;
  - données dans `server/data/<agrégat>.ts` derrière la façade `storage` ;
  - erreurs via `handleError`.
- Mettre à jour ce fichier à chaque PR. Tester dans le navigateur tout changement visible.
