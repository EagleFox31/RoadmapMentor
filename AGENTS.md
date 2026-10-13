# Instructions et Méthode de Travail des Agents (AGENTS.md)

Ce document formalise la méthode de travail obligatoire pour **toutes les sessions**, **tous les agents IA** et **tous les projets**, à appliquer rigoureusement et sans exception.

---

## 1. Règle d'Or : Vérification Systématique des Travaux en Cours

> **IMPORTANT** : D'autres IA ou développeurs peuvent travailler simultanément sur ce dépôt ou avoir effectué des modifications récentes.

Avant d'entreprendre **toute** action de modification, de refactorisation ou d'ajout de code :
1. **Inspecter l'état du dépôt (`git status`, `git log -n 5`)** :
   - Vérifier les branches actives, les commits récents et les fichiers modifiés non commités.
2. **Vérifier les processus et tâches en arrière-plan** :
   - Vérifier si des conteneurs, serveurs de dev ou commandes longues tournent déjà.
3. **Inspecter les documents de contexte et passation** :
   - Consulter `PASSATION.md`, `README.md`, et les fichiers récents dans `docs/` avant de supposer l'état d'un module.
4. **Vérifier la cohérence de l'environnement** :
   - Ne jamais écraser un travail non sauvegardé ou réécrire du code sans avoir d'abord compris les derniers ajouts.

---

## 2. Traçabilité Documentaire Obligatoire dans `docs/`

À chaque réalisation, refonte ou résolution de problème significatif, l'agent doit consigner son travail dans un fichier de documentation de type walkthrough dans `docs/` (par exemple [`docs/walkthrough-gemini.md`](docs/walkthrough-gemini.md)).

### Structure standard et obligatoire du Walkthrough :
1. **Identification de l'auteur & de la commande** :
   - Signaler en tout début de document que c'est **Gemini (ou l'IA intervenante) qui a effectué le travail à la demande explicite de l'utilisateur**.
2. **Ce qui a été trouvé** :
   - Diagnostic complet, état des lieux initial, contraintes observées (dépendances, CI, base de données, pièges éventuels).
3. **Ce qui a été modifié** :
   - Liste exhaustive et détaillée des fichiers modifiés/créés, explications des choix d'architecture et des décisions techniques.
4. **Si ça marche (Statut de fonctionnement)** :
   - Statut clair et précis confirmant si l'application et la fonctionnalité sont opérationnelles.
5. **Comment cela a été testé** :
   - Liste des tests exécutés : tests unitaires (`npm test`), vérification des types (`npm run check` / `tsc`), builds (`npm run build`, Docker), et validation réelle (curl, REST, interface, etc.).
6. **Idées d'innovation si applicable** :
   - Propositions d'améliorations futures, optimisations, évolutions UX ou sécuritaires pertinentes.

---

## 3. Règles Techniques Spécifiques à RoadmapMentor

- **Builds dans Docker** :
  - Toujours valider et construire les images dans Docker (`docker compose build app`, `docker compose build migrate`, `docker compose up -d`) pour s'assurer que le runtime conteneurisé fonctionne à l'identique de la production.
- **Intégrité des Migrations de Base de Données (Zéro Dérive)** :
  - Toute modification de `shared/schema.ts` doit s'accompagner d'une migration Drizzle valide dans `migrations/` et synchronisée avec `migrations/meta/`.
  - La commande `npx drizzle-kit generate` ne doit détecter **aucune** dérive avant livraison (`No schema changes, nothing to migrate`), car le pipeline CI GitHub Actions échoue immédiatement en cas de diff.
- **Rétrocompatibilité des Tests E2E** :
  - Les tests de parcours Playwright (`test/e2e/learner.e2e.py`, etc.) s'exécutent en CI sur le build de production et attendent des sélecteurs `data-testid` précis ainsi qu'un comportement prévisible.
  - Ne jamais supprimer de `data-testid` existant ou casser les flux d'inscription/connexion sans adapter en amont la suite de tests.
- **Discrétion des commits** :
  - Ne pas insérer de balise `Co-Authored-By` ou de mention d'IA dans les messages de commit Git (consigne utilisateur).
- **Lexique Fondamental : Andragogie vs Pédagogie** :
  - Le terme « pédagogie » / « pédagogique » est **strictement banni** du vocabulaire du projet.
  - RoadmapMentor forme des adultes et des développeurs professionnels : employer exclusivement le vocabulaire de l'**andragogie** / **andragogique** (apprentissage orienté vers la pratique réelle, l'autonomie, l'application concrète des compétences et le mentorat d'adultes).
