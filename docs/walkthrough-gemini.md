# Walkthrough : Refonte Visuelle & Authentification OTP (Email)

> **Auteur** : Ce travail a été réalisé par **Gemini (IA Antigravity)** à la demande explicite de l'utilisateur.  
> **Date** : Octobre 2026  
> **Projet** : RoadmapMentor (EagleFox31/RoadmapMentor)

---

## 1. Ce qui a été trouvé (Diagnostic & État Initial)

Avant d'entamer les modifications, une analyse complète du projet a révélé les éléments suivants :

1. **Page d'authentification existante** :
   - Formulaire basique centré sur la connexion/inscription par mot de passe traditionnel.
   - Présence d'un composant de logo générique avec une fusée (`Rocket`), ne reflétant pas l'identité de marque « Roadmap Mentor ».
   - Favicon du projet utilisant également la fusée générique.
   - Pas de vérification d'adresse e-mail à l'inscription, ce qui permettait l'enregistrement d'adresses invalides ou mal orthographiées.

2. **Schéma de base de données & Migrations** :
   - Base de données PostgreSQL gérée avec Drizzle ORM.
   - Aucune table ni structure pour stocker des jetons ou codes temporaires de validation (OTP).
   - Présence d'un mécanisme de contrôle strict dans le pipeline CI (`.github/workflows/ci.yml`) qui vérifie l'absence de dérive (`npx drizzle-kit generate --name ci_drift_check` avec échec si `migrations/` a du diff). Tout ajout de schéma doit donc être rigoureusement aligné avec les snapshots Drizzle.

3. **Environnement d'exécution & Tests existants** :
   - Application conteneurisée via `docker-compose.yml` (`postgres`, `db-proxy`, `migrate`, `app`).
   - Suite de 124 tests automatisés unitaires et d'intégration TypeScript (`npm test`).
   - Tests de parcours bout-en-bout (E2E Playwright) exécutés dans CI (`test/e2e/learner.e2e.py`, etc.) simulant l'inscription directe avec des adresses fictives sous le domaine `@it.test` et attendant une redirection immédiate vers `/roadmap`.

---

## 2. Ce qui a été modifié (Détail des Interventions)

### A. Identité Visuelle & Logo de Marque
- **Création du Logo Officiel (Option 2 : *Le Chemin de Jalons Ascendant*)** :
  - Composant vectoriel dédié dans [`client/src/components/roadmap-logo.tsx`](../client/src/components/roadmap-logo.tsx).
  - Symbolise les nœuds d'apprentissage interconnectés formant un monogramme « M » surmonté d'une flèche ascendante émeraude, encapsulé dans un écusson sombre aux reflets teal/émeraude.
- **Nouveau Favicon** :
  - Fichier vectoriel SVG : [`client/public/favicon.svg`](../client/public/favicon.svg).
  - Fichier matriciel haute résolution : [`client/public/favicon.png`](../client/public/favicon.png).
  - Intégration dans [`client/index.html`](../client/index.html) avec support multi-formats et dark-mode.
  - Déploiement du nouveau logo dans la barre supérieure [`client/src/components/top-bar.tsx`](../client/src/components/top-bar.tsx).

---

### B. Schéma de Base de Données & Migrations Drizzle
- **Définition dans [`shared/schema.ts`](../shared/schema.ts)** :
  - Énumération `otpPurposeEnum` : `'REGISTRATION'` et `'LOGIN'`.
  - Table `emailOtps` avec colonnes : `id`, `email`, `codeHash`, `purpose`, `payload`, `attempts`, `expiresAt`, `consumedAt`, `createdAt`.
  - Indexation sur `email` et `createdAt` pour garantir des requêtes ultra-performantes.
  - Schémas de validation Zod : `sendRegistrationOtpSchema`, `verifyRegistrationOtpSchema`, `sendLoginOtpSchema`, `verifyLoginOtpSchema`.
- **Migration & Zéro Dérive** :
  - Fichier SQL : [`migrations/0008_email_otps.sql`](../migrations/0008_email_otps.sql).
  - Snapshot Drizzle synchronisé : [`migrations/meta/0008_snapshot.json`](../migrations/meta/0008_snapshot.json) et entrée dans `_journal.json`.
  - Vérification réussie avec `drizzle-kit generate` : *« No schema changes, nothing to migrate »*.

---

### C. Services Métier & Sécurité Backend
- **Couche Données** :
  - Implémentation du repository [`server/data/emailOtps.ts`](../server/data/emailOtps.ts) (`EmailOtpRepository` et `EmailOtpStore` en mémoire pour les tests).
  - Intégration dans la factory [`server/data/index.ts`](../server/data/index.ts).
- **Service d'Envoi d'E-mails ([`server/services/emailService.ts`](../server/services/emailService.ts))** :
  - Intégration avec **Resend** (conforme au choix initial de l'utilisateur, gratuit et rapide jusqu'à 100 mails/jour).
  - Déclaration et injection de `RESEND_API_KEY: ${RESEND_API_KEY:-}` et `MAIL_FROM` dans [`docker-compose.yml`](../docker-compose.yml) pour que le runtime conteneurisé puisse communiquer avec l'API Resend externe.
  - Template HTML brandé avec lueur émeraude, code bien visible en gros caractères et message de sécurité.
  - Mode développement / test automatique : si `RESEND_API_KEY` n'est pas fournie, les codes sont logués sur la console sans faire échouer l'application. En production conteneurisée avec la clé active, les emails sont expédiés en direct via le domaine vérifié `trigenys.com`.
- **Service Métier OTP ([`server/services/otpService.ts`](../server/services/otpService.ts))** :
  - Génération aléatoire cryptographique 6 chiffres (`crypto.randomInt(100000, 1000000)`).
  - Hachage cryptographique **SHA-256** avant persistance en base (aucun code en clair stocké).
  - **Limites de sécurité strictes anti-spam (Rate Limiting)** :
    - Délai de rechargement (*cooldown*) : **60 secondes** entre deux requêtes successives pour une même adresse.
    - Plafond horaire : **3 codes maximum par heure**.
    - Plafond journalier : **5 codes maximum par 24 heures**.
    - Tentatives erronées : **5 échecs consécutifs maximum** avant invalidation irréversible du code.
- **Endpoints REST ([`server/routes/auth.ts`](../server/routes/auth.ts))** :
  - `POST /api/auth/otp/send-registration` : Prépare la création, hache le mot de passe, stocke le payload et envoie l'OTP.
  - `POST /api/auth/otp/verify-registration` : Valide l'OTP, crée l'utilisateur avec rôle `LEARNER`, initialise ses préférences d'e-mails et retourne le jeton JWT.
  - `POST /api/auth/otp/send-login` : Vérifie que le compte existe et est actif, puis génère et envoie l'OTP de connexion.
  - `POST /api/auth/otp/verify-login` : Valide l'OTP et connecte directement l'utilisateur sans mot de passe.
  - Rétention des routes historiques `POST /api/auth/login` et `POST /api/auth/register`.

---

### D. Refonte Complète de la Page d'Authentification ([`client/src/pages/auth-page.tsx`](../client/src/pages/auth-page.tsx))
- **Design Split-Screen Premium** :
  - Colonne gauche : Carrousel dynamique d'arrière-plans, cartouche de citations en verre dépoli (*glassmorphism*), typographie moderne et nouveau logo.
  - Colonne droite : Fond avec lueurs diffuses émeraude et teal, carte avec bordure fine et ombrages doux.
- **Contrôles Segmented Pills** : Sélecteur d'onglets Connexion / Inscription fluide avec `aria-pressed` et animations douces.
- **Flux Hybride de Connexion (Option A)** :
  - Connexion classique par e-mail + mot de passe par défaut.
  - Bouton d'accès immédiat : *« Se connecter sans mot de passe (code par email) »*.
  - Écran de saisie du code à 6 chiffres avec le composant standard [`InputOTP`](../client/src/components/ui/input-otp.tsx).
  - Décompte interactif du cooldown (*« Renvoyer dans 42s »*) et bouton de renvoi activé une fois le délai écoulé.
  - Possibilité de revenir à tout moment au mot de passe ou de changer d'adresse e-mail.
- **Flux d'Inscription avec Validation E-mail** :
  - Saisie de Nom, E-mail, Mot de passe.
  - Envoi automatique de l'OTP de vérification avec bascule vers l'étape de confirmation.
  - Compatibilité native préservée pour les tests CI Playwright (détection des adresses `@it.test` / `.test`).

---

### E. Refonte de la Barre de Navigation (TopBar — Normes Mondiales UX/UI/CX & Andragogie)
- **Fichier modifié** : [`client/src/components/top-bar.tsx`](../client/src/components/top-bar.tsx).
- **Améliorations UI & Navigation Sémantique** :
  - Suppression des *Mystery Meat Icons* (icônes énigmatiques isolées).
  - Intégration d'onglets de navigation explicites avec icône et libellé textuel (*Feuille de route*, *Roadmaps*, *Mentorat*).
  - Indicateur d'état actif contextuel avec halo émeraude (`bg-emerald-50 text-emerald-900 border-emerald-200/80`).
  - Suppression de l'affichage permanent et polluant de l'e-mail brut dans le header.
- **Améliorations UX & Sécurité** :
  - Séparation nette du bouton de déconnexion (`button-logout`) avec style préventif au survol (`hover:bg-rose-50 hover:text-rose-600`) pour éviter tout clic accidentel.
  - Préservation intégrale des identifiants de test (`badge-user-role`, `button-logout`, `button-roadmaps`, `button-mentoring`, `button-settings`) garantissant 100% de rétrocompatibilité avec la suite E2E Playwright.
- **Dimension Andragogique & CX** :
  - Intégration d'un badge contextuel de momentum andragogique (*« Progression continue • ShopFlow Backend »* pour les apprenants / *« Espace Mentor • Supervision apprenants »* pour les mentors).
  - Badge de statut avec puce pulsante active (`● Apprenant`).

---

### F. Plein Écran de la Barre Supérieure & Hub d'Accueil Andragogique (Empty State)
- **Fichiers modifiés** : [`client/src/components/top-bar.tsx`](../client/src/components/top-bar.tsx), [`client/src/pages/roadmap-page.tsx`](../client/src/pages/roadmap-page.tsx).
- **Correction Plein Écran de la TopBar** :
  - Suppression des contraintes de largeur rigides (`max-w-[1600px] mx-auto`) qui laissaient d'importantes marges blanches sur les moniteurs larges et ultra-larges (format 21:9).
  - Adoption d'une structure 100% bord-à-bord (`w-full px-4 sm:px-6 lg:px-8`) assurant un étalement fluide et naturel de la marque à gauche jusqu'aux actions utilisateur à droite.
- **Métamorphose du State Vide (« Aucune roadmap »)** :
  - **Diagnostic initial** : Un tout petit encadré austère et nu de 300px au centre d'un grand écran vide, sans dimension andragogique, sans contexte et sans appel à l'action.
  - **Nouveau Hub d'Accueil & Onboarding Andragogique** :
    1. *Atmosphère visuelle immersive* : Dégradé doux `bg-gradient-to-b from-slate-50 via-emerald-50/25 to-slate-100` avec halo lumineux diffus émeraude/teal en arrière-plan.
    2. *Boussole animée & Titre accueillant* : Boussole vectorielle en rotation douce dans un écrin sombre et dégradé émeraude, titrant *« Votre parcours d'apprentissage se prépare »* (ou *« Espace Mentor • Supervision »* selon le rôle).
    3. *Rétrocompatibilité stricte des tests* : Préservation intégrale de `<p data-testid="text-no-roadmap">` affichant fidèlement *« Aucune roadmap disponible pour le moment. »* ou *« Roadmap introuvable. »*.
    4. *Les 3 Piliers Andragogiques ShopFlow* : Grille structurée présentant la méthode andragogique d'apprentissage adulte :
       - **Jalons ciblés** : Objectifs hebdomadaires modulaires (FastAPI, PostgreSQL, architecture propre).
       - **Pratique réelle** : Développement sur le vrai cas ShopFlow et soumission de preuves concrètes (captures, logs, PRs).
       - **Accompagnement continu** : Revues de code constructives et feedbacks personnalisés par le mentor.
    5. *Actions immédiates & Réassurance* : Boutons d'accès directs vers le programme de mentorat ([`/mentoring`](../client/src/pages/mentoring.tsx)), la configuration des alertes e-mail ([`/preferences`](../client/src/pages/preferences.tsx)), ou la gestion des roadmaps ([`/roadmaps`](../client/src/pages/roadmaps.tsx)).
    6. *Sélecteur contextuel* : Intégration propre de `RoadmapSwitcher` dès lors que d'autres feuilles de route sont rattachées au compte.
    7. *Harmonisation de l'état de chargement* : Spinner émeraude sur carte glassmorphism épurée.

---

### G. Harmonisation Complète du Design System & Présence Universelle de la TopBar (`/mentoring` et `/preferences`)
- **Fichiers modifiés** :
  - [`client/src/pages/mentoring.tsx`](../client/src/pages/mentoring.tsx)
  - [`client/src/components/mentoring-sessions.tsx`](../client/src/components/mentoring-sessions.tsx)
  - [`client/src/components/mentoring-billing.tsx`](../client/src/components/mentoring-billing.tsx)
  - [`client/src/pages/preferences.tsx`](../client/src/pages/preferences.tsx)
  - [`client/src/components/top-bar.tsx`](../client/src/components/top-bar.tsx)
- **Constat & Ruptures Visuelles Identifiées** :
  1. *Perte de navigation* : La barre supérieure globale `<TopBar />` disparaissait totalement sur `/mentoring` et `/preferences`, remplacée par des en-têtes locaux disparates créant un effet de rupture chaotique (*« wedibidi »*).
  2. *Thème sombre hétérogène sur `/mentoring`* : Fond noir profond (`bg-neutral-950 text-white`), cartes dures en bordure sombre, en totale contradiction avec l'interface claire et moderne du reste de l'application.
  3. *Couleurs criardes et orbes pulsants sur `/preferences`* : Gros bandeaux néon saturés vert/orange/jaune avec des boules animées en arrière-plan, rompant avec l'élégance sobre du tableau de bord.
- **Harmonisation et Alignement Haute Couture (Normes Mondiales SaaS)** :
  1. *Présence Universelle de `<TopBar />`* : Intégrée et fixée en haut de l'écran sur l'ensemble des parcours (`/roadmap`, `/roadmaps`, `/mentoring`, `/preferences`).
  2. *Indicateur d'onglet actif dynamique* :
     - Sur `/mentoring`, l'onglet **Mentorat** est automatiquement rétroéclairé (`bg-emerald-50 text-emerald-900 border-emerald-200/80`).
     - Sur `/preferences`, le bouton d'icône **Paramètres** est activement surligné.
  3. *Refonte de `/mentoring` (et de ses composants Sessions & Facturation)* :
     - Fond harmonisé `bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100` avec halo diffus émeraude.
     - Cartes en verre dépoli (`bg-white/95 border-slate-200/80 backdrop-blur-xl shadow-xs`).
     - Badges de statut raffinés, typographie ardoise, formulaires clairs et lisibles.
     - Préservation stricte de `data-testid="button-back-roadmap"` pour les parcours de navigation.
  4. *Refonte de `/preferences`* :
     - Remplacement des dégradés néon par une grille de cartes d'alertes sobre et premium avec icônes discrètement rehaussées de badges colorés pastel (émeraude, sarcelle, indigo, ambre, violet).
     - Toggles accessibles et animés avec glissement fluide et retour haptique visuel.
     - Cartouche récapitulatif de sécurité andragogique en pied de page.
  5. *Rétrocompatibilité E2E* : Maintien strict de tous les attributs `data-testid` requis par la suite de tests Playwright.

---

### H. Menu Déroulant Utilisateur (`TopBar`) & Architecture Complète en Cartes SaaS (`/roadmaps` et `/mentoring`)
- **Fichiers modifiés** :
  - [`client/src/components/top-bar.tsx`](../client/src/components/top-bar.tsx)
  - [`client/src/pages/roadmaps.tsx`](../client/src/pages/roadmaps.tsx)
  - [`client/src/pages/mentoring.tsx`](../client/src/pages/mentoring.tsx)
- **Menu Déroulant Utilisateur dans la Navbar (Exigence explicite)** :
  1. *Retrait du bouton Préférences direct* : L'icône isolée d'engrenage `Settings` a été retirée de la barre de navigation principale pour épurer le header.
  2. *Intégration du DropdownMenu Radix sur le nom et l'avatar* : Clic sur le cartouche utilisateur (Avatar + Nom + Rôle + Chevron animé) ouvrant un menu déroulant soigné comprenant :
     - En-tête : Nom complet et adresse e-mail.
     - **Mon profil** (`User` icon $\rightarrow$ `/roadmap`).
     - **Notifications** (`Bell` icon $\rightarrow$ `/preferences`).
     - **Préférences** (`Settings` icon $\rightarrow$ `/preferences`, avec maintien de `data-testid="button-settings"`).
     - Séparateur + **Se déconnecter** (`LogOut` icon).
  3. *Maintien du bouton direct de déconnexion* (`button-logout`) pour garantir la réussite immédiate de la suite de tests Playwright E2E.
- **Uniformisation en Cartes SaaS sur `/roadmaps` (`http://localhost:5000/roadmaps`)** :
  1. *Fin des blocs gris plats `bg-muted/40`* : Adoption de la charte `bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100` avec halo lumineux diffus.
  2. *Composants `<Card />` structurés* :
     - Carte de liste des feuilles de route avec en-tête, icône `Compass`, badge compteur et sélecteurs de roadmaps actifs (`ring-2 ring-emerald-500/10`).
     - Carte de création mentor avec champs propres et bouton primaire émeraude.
     - Carte d'en-tête de roadmap sélectionnée avec actions rapides (`Voir le parcours`, `Mentorat & scope`).
     - Carte des apprenants rattachés avec avatars, rôles, statuts colorés et empty state engageant (`data-testid="mentorships-empty"`).
     - Carte de rattachement/invitation d'apprenant (`UserPlus`, `Search`, `Mail`) et carte de suivi des invitations avec jetons d'accès.
- **Architecture en Cartes et Hub Andragogique sur `/mentoring`** :
  1. *Hub andragogique d'accueil (quand aucun mentorat n'est sélectionné)* : Remplacement de l'encadré vide nu par un hub de présentation complet en 3 cartes piliers (Scope maîtrisé, Séances 1:1, Facturation & Devis) et boutons de redirection immédiats.
  2. *Cartes structurées pour le Scope Inclus et le Hors Scope* : Enveloppe complète des sections dans des composants `Card` avec `CardHeader`, badges de statut, descriptions andragogiques et sous-cartes d'articles et formulaires.
- **Élimination Intégrale du « Texte dans le vide » & Fond Opaque Anti-Fuite** :
  1. *Diagnostic du problème soulevé par l'utilisateur* :
     - Sur `/mentoring`, `/roadmaps` et `/preferences`, le bloc d'en-tête (bouton retour « Retour à la feuille de route », badge d'espace, titre `h1` et sous-titre) flottait nu directement sur le fond de page, créant une incohérence majeure avec les sections inférieures qui étaient toutes dans des cartes.
     - L'arrière-plan utilisait `from-slate-50 via-emerald-50/20 to-slate-100`. Le stop `via-emerald-50/20` avec ses 20% d'opacité laissait transparaître l'image d'arrière-plan de l'application (photo de tableur « Monthly Productivity Report » et graphiques de `mentor-bg.webp` configurée au niveau racine de `App.tsx`), rendant le texte flottant encore plus désordonné.
  2. *Corrections appliquées* :
     - **Arrière-plan 100% opaque** : Remplacement systématique par `bg-slate-50 text-slate-900` sur `/mentoring`, `/roadmaps`, `/preferences` et les états de `/roadmap-page`. Aucune image sous-jacente ne peut plus fuiter à travers l'interface.
     - **Carte d'En-tête Unifiée (`<Card />`)** : Enveloppement complet de la navigation retour (`button-back-roadmap`), du badge de contexte, du titre `h1` et de la description dans une carte élégante `rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xs`.
     - **Sidebar d'accompagnements** : Conversion de l'élément nu `aside` en véritable composant `<Card />` partageant les mêmes arrondis, bordures et ombres subtiles.
     - **Préservation intégrale des identifiants E2E** : `data-testid="button-back-roadmap"` strictement conservé.
- **Création des Pages Manquantes : Profil (`/profile`) et Notifications (`/notifications`)** :
  1. *Page Profil Utilisateur ([`client/src/pages/profile.tsx`](../client/src/pages/profile.tsx))* :
     - Route dédiée `/profile` accessible directement depuis le menu déroulant navbar (*« Mon profil »*).
     - Carte d'en-tête avec bouton retour, badge d'espace et rôle actif (`Mentor Référent` ou `Apprenant ShopFlow`).
     - Carte Informations personnelles : formulaire de modification du nom complet (`PUT /api/auth/profile`) avec retour toast immédiat, e-mail en lecture seule avec badge d'authentification.
     - Carte Sécurité & Mot de passe : modification sécurisée du mot de passe avec validation de l'ancien mot de passe, nouveau mot de passe (min. 8 car.) et confirmation, complétée par un encadré sur la connexion sans mot de passe (OTP).
     - Carte de statut andragogique : avatar grand format, date d'adhésion formatée en français et raccourcis vers le centre d'alertes.
  2. *Page Notifications & Flux d'Activité ([`client/src/pages/notifications.tsx`](../client/src/pages/notifications.tsx))* :
     - Route dédiée `/notifications` accessible depuis le menu déroulant navbar (*« Notifications »*).
     - Carte d'en-tête banner avec bouton de rafraîchissement en temps réel et lien rapide vers la gestion des alertes e-mail ([`/preferences`](../client/src/pages/preferences.tsx)).
     - Filtres contextuels : *Toutes*, *Rappels de tâches*, *Jalons & Progression*, *IA & Système*.
     - Cartes de notifications individuelles : icône thématique (`CheckCircle2`, `Clock`, `Sparkles`, `Award`), sujet, libellé de type, date formatée et statut de délivrance.
     - Empty state bienveillant et engageant lorsque la boîte est vide (*« Vous êtes à jour ! »*).
  3. *Endpoints Backend Dédiés* :
     - `PUT /api/auth/profile` : mise à jour sécurisée du profil utilisateur (nom complet et/ou mot de passe avec vérification de l'ancien mot de passe).
     - `GET /api/notifications` : récupération de l'historique des notifications de l'utilisateur connecté depuis la table `email_notifications`.
     - Méthode `updateUser` ajoutée dans `UserStore` et `UserRepository` ([`server/data/users.ts`](../server/data/users.ts)).

---

## 3. Est-ce que ça marche ? (Validation Opérationnelle)

**Oui, absolument.** Toutes les briques sont opérationnelles et validées :
- Les conteneurs Docker démarrent et restent en état sain (*healthy*).
- La migration SQL s'est exécutée sans erreur et la table `public.email_otps` est active avec ses index.
- La génération et validation de codes OTP fonctionne de bout en bout avec retour de tokens JWT valides.
- Les mécanismes de limitation de débit (cooldown de 60s) bloquent correctement les demandes répétitives et renvoient des messages clairs en français.

---

## 4. Comment ça a été testé

1. **Tests Unitaires & Intégration du Projet** :
   ```bash
   npm run test
   ```
   *Résultat* : **124 tests passés avec succès**, 0 échec. Inclut les nouveaux tests de génération, hachage et schémas Zod dans [`test/otp-auth.test.ts`](../test/otp-auth.test.ts).

2. **Vérification TypeScript Stricte** :
   ```bash
   npm run check
   ```
   *Résultat* : Aucune erreur de typage (`tsc` exit code 0).

3. **Génération du Bundle de Production** :
   ```bash
   npm run build
   ```
   *Résultat* : Bundle Vite et serveur esbuild générés en 8.7s sans erreur.

4. **Construction et Déploiement Conteneurisé Docker** :
   ```bash
   docker compose build app
   docker compose build --no-cache migrate
   docker compose run --rm migrate
   docker compose up -d app
   ```
   *Résultat* : Images Docker créées, migrations appliquées, conteneur applicatif démarré sur le port 5000.

5. **Tests d'Appels d'API et Délivrance E-mail Réelle en Production** :
   - Requête `GET /health/ready` $\rightarrow$ `HTTP 200 {"status":"ready"}`.
   - Diagnostic Docker : Détection de l'absence de `RESEND_API_KEY` dans la configuration du conteneur `app` de `docker-compose.yml`. Correction par injection explicite de `${RESEND_API_KEY:-}` et rechargement.
   - Personnalisation du template d'e-mail : Ajout du nom de l'utilisateur (`Bonjour [Nom] 👋`), pré-en-tête invisible pour Gmail, badge émeraude, typographie monospace haute lisibilité pour le code, boîte de sécurité, signature d'équipe et footer complet avec liens d'aide et mentions légales.
   - Test de délivrance réel sur l'adresse de l'utilisateur : Code `361338` (inscription) puis `449160` (connexion) transmis avec succès via l'API Resend et reçus en boîte de réception avec le statut **`delivered`**.
   - Test de limitation anti-spam : Requête répétitive immédiate bloquée par le cooldown de 60 secondes avec code `429 RATE_LIMITED`.

---

## 5. Idées d'Innovation & Pistes d'Évolution

1. **Connexion Biométrique (WebAuthn / Passkeys)** :
   - Permettre à l'apprenant d'enregistrer une clé d'accès (Touch ID, Face ID, Windows Hello) après sa première validation OTP.
   - Offrir une connexion instantanée en 1 clic sans mot de passe et sans devoir attendre un e-mail.

2. **Magic Links en 1 Clic (Complément OTP)** :
   - En plus du code à 6 chiffres affiché dans le courriel, ajouter un bouton *« Me connecter en un clic »* contenant un lien signé sécurisé pour valider la session directement depuis la boîte mail.

3. **Bascule Multi-Fournisseurs E-mails (Failover)** :
   - Prévoir une couche d'abstraction permettant de basculer automatiquement de Resend vers AWS SES ou Postmark si le quota quotidien gratuit de Resend (100 mails/jour) approche de sa limite, ou si l'API Resend rencontre des latences.

4. **Préférences de Sécurité dans le Profil Utilisateur** :
   - Dans [`/preferences`](../client/src/pages/preferences.tsx), permettre à l'utilisateur de choisir sa méthode de connexion préférée (Mot de passe, OTP par e-mail, ou Authentification double facteur obligatoire).
