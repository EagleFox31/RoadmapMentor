# Passation — 2026-10-13

## Objectif en cours
Rendre l'app partageable : refonte UI responsive côté mentoré + auth OTP e-mail. Commités en 2 PR empilées : #86 `feat/auth-otp-brand` (OTP + login + logo) puis `feat/learner-responsive-ui` (base #86 : responsive, TopBar, /roadmaps, /mentoring, /preferences, docs). Fusionner #86 d'abord. Reste la recette prod.

## Fait
- Refonte login split-screen + logo de marque + favicon. `client/src/pages/auth-page.tsx` (792 lignes), `client/src/components/roadmap-logo.tsx`, `client/public/favicon.svg|png`, `client/index.html`.
- Auth OTP e-mail (inscription + connexion sans mot de passe), rate limiting 60s/3h/5j/5 essais. `server/services/otpService.ts:65-78`, `server/services/emailService.ts`, `server/data/emailOtps.ts`, `server/routes/auth.ts`, migration `migrations/0008_email_otps.sql`, schéma `shared/schema.ts:46,127`, test `test/otp-auth.test.ts`.
- Responsive mentoré (360/390/768) : barre réduite `client/src/components/top-bar.tsx:46,49,51,74`, carte ressource en colonne + boutons tactiles toujours visibles `client/src/components/resources-list.tsx:102,147,206`, grilles 2 cols → 1 col sur mobile dans modales semaine/IA/ressource.
- Modales adaptées (marge 12px, max-h écran, défilement interne, padding réduit) `client/src/components/ui/dialog.tsx:40`.
- Upload capture flex-wrap `client/src/components/ScreenshotUploader.tsx:84`, viewer PDF en `dvh` `client/src/components/PdfResourceViewer.tsx:100`, marges page réduites `client/src/pages/roadmap-page.tsx:439,474,505`.
- `client/public/favicon.png` passé de 19 Ko à 306 Ko : voulu.
- Refonte TopBar aux normes mondiales UX/UI/CX : navigation sémantique claire, indicateur d'onglet actif, retrait de l'e-mail permanent, puce de statut animée, hover préventif sur déconnexion, sélecteurs E2E préservés.
- Navbar plein écran (bord-à-bord) : suppression de la contrainte 1600px qui laissait des bandes vides sur les écrans larges/ultrawides (21:9), padding fluide `px-4 sm:px-6 lg:px-8`.
- Hub d'accueil & Onboarding Andragogique (Empty State `/roadmap`) : métamorphose du message austère « Aucune roadmap disponible pour le moment » en un écran d'accueil engageant (`client/src/pages/roadmap-page.tsx:403-450`) avec boussole animée, halo lumineux, les 3 piliers andragogiques ShopFlow (Jalons, Pratique, Revues), sélecteur de roadmap et boutons de redirection, préservant strictement `data-testid="text-no-roadmap"`.
- Harmonisation intégrale du Design System & Universalité de la TopBar :
  - Restauration de la `<TopBar />` globale sur `/mentoring` et `/preferences` (elle avait disparu au profit d'en-têtes locaux disparates créant une rupture visuelle "wedibidi").
  - Indicateur d'onglet actif dynamique : l'onglet "Mentorat" s'illumine sur `/mentoring`, et l'icône "Settings" sur `/preferences`.
  - Refonte complète de `/mentoring` et ses sous-composants (`mentoring-sessions.tsx`, `mentoring-billing.tsx`) : passage du thème noir discordant (`bg-neutral-950`) au thème SaaS clair cohérent (`bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100`, cartes glassmorphism `bg-white/95 border-slate-200/80`).
  - Refonte de `/preferences` : suppression des orbes pulsants agressifs et des bannières néon vert/orange criardes au profit de cartes d'alertes pastel avec switches fluides et cartouche récapitulatif.
  - Préservation intégrale des identifiants Playwright (`button-back-roadmap`, `button-mentoring`, `button-settings`, etc.).
- Menu Déroulant Utilisateur (`DropdownMenu`) & Architecture Complète en Cartes :
  - Navbar (`top-bar.tsx`) : suppression de l'icône directe Préférences au profit d'un menu déroulant interactif sur l'identité de l'utilisateur (Mon profil, Notifications, Préférences avec `data-testid="button-settings"`, Déconnexion). Maintien du bouton direct `button-logout` pour la suite Playwright.
  - Refonte complète de `/roadmaps` (`roadmaps.tsx`) : fin des blocs gris `bg-muted/40`, adoption de la charte visuelle émeraude/ardoise, structure complète en cartes `<Card />` (feuilles de route, formulaire mentor, en-tête active, apprenants rattachés, invitations avec jetons).
  - Hub andragogique & structuration en cartes sur `/mentoring` (`mentoring.tsx`) : hub d'accueil en 3 piliers quand aucun mentorat n'est sélectionné, cartes structurées pour Scope inclus et Hors scope avec en-têtes et descriptions claires.
- Élimination intégrale du texte dans le vide & Fonds opaques anti-fuite :
  - Enveloppe complète des en-têtes de page (retour, badge, titre, sous-titre) dans des composants `<Card className="rounded-3xl border-slate-200/80 bg-white/95 ...">` sur `/mentoring`, `/roadmaps` et `/preferences`.
  - Sidebar d'accompagnements transformée en composant `<Card />` standardisé.
  - Arrière-plan 100% opaque `bg-slate-50 text-slate-900` sur `/mentoring`, `/roadmaps`, `/preferences` et `/roadmap-page` pour éliminer toute transparence accidentelle (`via-emerald-50/20`) qui laissait transparaître l'image de fond (`mentor-bg.webp`).

## Décisions prises
- Login OTP + password côté client (bouton « Se connecter sans mot de passe »), routes historiques `/api/auth/login` et `/api/auth/register` conservées : compat E2E et comptes existants.
- Rate limit : cooldown 60s, plafond 3/h, 5/jour, 5 mauvais essais. Message FR exact : « Veuillez patienter 60s avant de demander un nouveau code. ». Blocage avant toute écriture.
- Codes OTP SHA-256 avant persistance, aucun en clair. Génération via `crypto.randomInt`.
- Mode dev sans `RESEND_API_KEY` : code loggé `[OTP] Sent REGISTRATION code to <email>: <6chiffres>`, pas d'erreur ; CI inchangée.
- Édition/suppression de ressources côté mentor : toujours visibles sur mobile (le hover ne marche pas au tactile).

## Reste à faire
1. Revue + fusion #86 puis PR UI. Suivis notés dans #86 : OTP d'inscription non imposé côté serveur (`/api/auth/register` ouvert, bypass `.test` client), `send-login` renvoie 404 sur e-mail inconnu (énumération de comptes).
2. **RM-021 tarification** — plan prêt : [docs/mentor-pricing.md](docs/mentor-pricing.md), fiche [docs/backlog.md](docs/backlog.md). Branche `feat/rm-021-package-price-correction` **depuis `main` après** les commits OTP/UI. Tranche 1 seulement (PATCH forfait non facturé). Ne pas mélanger avec l'arbre local actuel.
3. Vérifier en navigateur réel les modales et le lecteur vidéo YouTube (le headless le rend noir).
4. Tester la limite de 5 mauvais essais sur un code OTP valide (non vérifiée : le cooldown de 60s a bloqué).
5. Mettre à jour les E2E Playwright pour couvrir le flux OTP ; adapter `test/e2e/learner.e2e.py` si l'inscription publique passe désormais obligatoirement par OTP.
6. Prod : poser `RESEND_API_KEY` sur Render, vérifier qu'un vrai mail arrive. Puis parcours authentifié prod (jamais fait).
7. Nettoyer branches locales fusionnées. AWS #27/#28 **différés** (décision 8 oct., issue #25).

## Pièges / contexte
- Stack Docker tourne : app `:5000`, postgres, db-proxy `:5444`. Bundle courant servi : `assets/index-DZVVTYSx.js`.
- Rebuild image : `docker compose build app --no-cache && docker compose up -d app`. Après 429 : `docker restart roadmapmentor-app-1`.
- Comptes test en base locale : `mob.learner.1791841606@it.test` (LEARNER), `mob.mentor.1791841606@it.test` (MENTOR). PWD learner `Test123!`, mentor `Mentor-Test-123!`.
- Promouvoir en mentor : `docker exec roadmapmentor-postgres-1 psql -U roadmapmentor -d roadmapmentor -c "update users set role='MENTOR' where email='…'"`. `scripts/create-mentor.ts` ne se connecte pas depuis l'hôte sans proxy exposé (le db-proxy compose n'expose aucun port).
- E2E locaux qui créent un mentor : exposer un proxy temporaire `docker run -d --rm --name e2e-db-proxy --network <réseau compose> -p 5444:80 -e ALLOW_ADDR_REGEX='.*' ghcr.io/neondatabase/wsproxy:latest`, puis exporter `DATABASE_URL=postgresql://roadmapmentor:roadmapmentor@postgres:5432/roadmapmentor DATABASE_WS_PROXY=localhost:5444/v1 DATABASE_WS_PROXY_INSECURE=true NODE_ENV=development`. `mentor-learner` et `roadmaps-ui` utilisent une route dev-only (404 sur le build Docker, hors CI).
- Lire un code OTP en dev : `docker logs --since=10s roadmapmentor-app-1 | grep -oE "code to <email>: [0-9]+"`.
- E2E locaux : `TEST_BASE_URL=http://localhost:5000 python test/e2e/<nom>.e2e.py`. Supprimer `test/e2e/__pycache__` avant `git add`.
- Windows : tuer un serveur de test via `netstat -ano | grep :5055` puis `taskkill //PID <pid> //F //T`.
- `roadmapmentor.env` : n'était pas ignoré (seul `.env` l'était) ; `*.env` ajouté au `.gitignore` dans #86. Ne jamais l'ajouter.
- CI drift Drizzle : tout changement de `shared/schema.ts` doit avoir sa migration + snapshot `migrations/meta/*` synchronisé, sinon `drizzle-kit generate --name ci_drift_check` échoue.
- Architecture : routes `server/routes/<domaine>.ts`, accès `server/access/`, données `server/data/<agrégat>.ts` (façade `server/storage.ts`), erreurs `server/domain/errors.ts`.
- Mettre à jour ce fichier à chaque PR ; tester dans le navigateur tout changement visible avant livraison.
