# RoadmapMentor — Backlog produit et technique

Ce backlog transforme l'analyse du dépôt en travaux ordonnés et vérifiables. Il couvre les écarts fonctionnels, la sécurité, la qualité, les performances et la préparation à la production observés le 5 octobre 2026.

## Légende

- **P0 — Bloquant** : empêche un parcours essentiel ou une mise en production sûre.
- **P1 — Important** : requis pour une bêta publique fiable.
- **P2 — Amélioration** : améliore la maintenabilité, les performances ou le passage à l'échelle.
- **Taille** : estimation relative de complexité (`S`, `M`, `L`), à affiner lors du planning.

## Vue d'ensemble

| ID | Priorité | Phase | Taille | Élément | Dépendances |
| --- | --- | --- | --- | --- | --- |
| RM-001 | P0 | Release | S | Réparer l'inscription publique | — |
| RM-002 | P0 | Platform | M | Ajouter un parcours contrôlé de création des mentors | RM-001 |
| RM-003 | P0 | Mentoring OS | L | Fournir l'interface de gestion des roadmaps et mentorats | RM-002 |
| RM-004 | P0 | Domain | M | Ajouter un contexte et un sélecteur multi-roadmap | RM-003 |
| RM-005 | P0 | Foundation | L | Corriger les vulnérabilités des dépendances de production | — |
| RM-006 | P0 | Platform | L | Introduire des migrations de base de données versionnées | — |
| RM-007 | P1 | Release | L | Ajouter les tests d'intégration API et les parcours E2E | RM-001, RM-003, RM-004, RM-006 |
| RM-008 | P1 | Platform | M | Renforcer le cycle de vie de l'authentification | RM-001 |
| RM-009 | P1 | Platform | M | Durcir la surface HTTP et les opérations coûteuses | RM-008 |
| RM-010 | P1 | Domain | L | Réduire les requêtes N+1 et garantir l'unicité de la progression | RM-006 |
| RM-011 | P1 | Platform | M | Rendre les tâches planifiées sûres en multi-instance | — |
| RM-012 | P1 | Platform | L | Ajouter un stockage objet partagé pour la production | — |
| RM-018 | P1 | Mentoring OS | L | Ajouter des labs guidés et leur workflow de validation | RM-004, RM-006 |
| RM-019 | P1 | Mentoring OS | M | Lire les vidéos et ressources compatibles dans l'application | RM-004 |
| RM-013 | P2 | Foundation | L | Découper les monolithes `routes.ts` et `storage.ts` | RM-007 |
| RM-014 | P2 | Release | M | Réduire le poids du frontend et des médias | — |
| RM-020 | P1 | Mentoring OS | M | Inviter un apprenant par e-mail avec inscription par lien | RM-002, RM-003, RM-006 |
| RM-015 | P2 | Foundation | S | Nettoyer les dépendances et avertissements d'outillage | RM-005 |
| RM-016 | P2 | Platform | L | Implémenter réellement l'infrastructure cloud Terraform | RM-006, RM-012 |
| RM-017 | P2 | Release | M | Ajouter observabilité, alertes et procédures d'exploitation | RM-011, RM-016 |

## P0 — Bloquants

### RM-001 — Réparer l'inscription publique

> **Statut : terminé, sauf un critère (voir ci-dessous) — 2026-10-05.**
> **Comment :** le champ `role` et le sélecteur « Mentor » ont été retirés du formulaire (`client/src/pages/auth-page.tsx`), qui n'envoie plus que `fullName`, `email` et `password`. `handleError` (`server/routes.ts`) renvoie désormais `400 { error: "Validation failed", issues }` pour toute `ZodError` au lieu de `500`. Le serveur garde la création forcée en `LEARNER` et le schéma strict.
> **Pourquoi :** le schéma strict est le bon garde-fou anti-élévation de rôle ; c'était donc le client qui était faux. Une erreur de validation est une erreur client, pas interne.
> **Preuve :** `test/integration/mentor-learner.integration.ts` (un appel public avec `role: "MENTOR"` renvoie 400) et `test/e2e/mentor-learner.e2e.py` (inscription réelle via l'interface, absence de sélecteur de rôle, arrivée sur `/roadmap` en « Apprenant »).
> **Reste :** la notification d'erreur affiche encore le JSON brut du 400 ; il faut formater `issues` côté client.


**Constat**

Le formulaire envoie le champ `role`, alors que `publicRegistrationSchema` l'interdit avec un schéma strict. L'interface propose aussi le rôle mentor, tandis que l'API crée volontairement uniquement des apprenants. Une inscription normale échoue donc avant la création du compte.

**Travail**

- [x] Retirer le sélecteur de rôle du formulaire public.
- [x] Envoyer uniquement `fullName`, `email` et `password` à `/api/auth/register`.
- [x] Conserver la création forcée du rôle `LEARNER` côté serveur.
- [x] Retourner une réponse `400` structurée pour les données invalides au lieu d'une erreur interne générique.
- [x] Ajouter un test couvrant le contrat réel entre le formulaire et l'API. (e2e + intégration)

**Critères d'acceptation**

- [x] Un nouvel apprenant peut s'inscrire, être connecté et arriver sur `/roadmap`.
- [x] Un appel public contenant `role: "MENTOR"` est refusé.
- [x] Aucun contrôle client ne permet une élévation de rôle.
- [ ] Les erreurs de validation sont compréhensibles dans l'interface. (non fait : le message brut s'affiche encore)

### RM-002 — Ajouter un parcours contrôlé de création des mentors

> **Statut : implémenté, en attente de revue/PR — 2026-10-05.** Branche `feat/rm-002-mentor-bootstrap` (worktree `../roadmapmentor-rm002`, base `fix/rm-005-prod-deps`, non poussée). Mécanisme : commande opérateur `npm run mentor:create` (sans changement de schéma), idempotente, refuse de promouvoir un apprenant, mot de passe ≥ 12 caractères (généré et affiché une fois, ou `MENTOR_PASSWORD`), ligne `[audit]` à chaque création. Vérifié sur Postgres jetable : création, rejeu sans effet, conflit apprenant refusé, connexion du mentor créé, inscription publique avec `role` rejetée (400). Tests unitaires de la politique ; documentation opérateur dans `docs/deployment.md` et README. Limites : la trace d'audit est une ligne de log (pas de table dédiée) ; pas de création de mentor depuis l'interface (hors périmètre, invitation éventuelle à étudier avec RM-003).

**Constat**

La création de mentors existe uniquement dans la route de données de test, désactivée en production. Aucun parcours sécurisé ne permet de provisionner un vrai mentor.

**Travail**

- Choisir et implémenter un mécanisme contrôlé : invitation, administration ou commande d'amorçage.
- Définir qui peut créer un mentor et tracer l'opération.
- Prévoir l'expiration et l'usage unique des invitations si cette option est retenue.
- Documenter le premier compte mentor d'une nouvelle installation.

**Critères d'acceptation**

- Une installation de production peut créer son premier mentor sans modifier directement la base.
- L'inscription publique ne peut jamais créer un mentor.
- Le parcours possède des tests d'autorisation et une documentation opérateur.

### RM-003 — Fournir l'interface de gestion des roadmaps et mentorats

> **Statut : implémenté, en attente de revue/PR — 2026-10-05.** Branche `feat/rm-003-mentoring-ui` (worktree `../roadmapmentor-rm003`, base `feat/rm-002-mentor-bootstrap`, non poussée). Livré : page `/roadmaps` (créer/consulter ses roadmaps, mentorats avec rôles et statuts, rattachement d'un apprenant par e-mail ; états chargement, vide, erreur, conflit « déjà rattaché »), bouton de navigation, route `GET /api/learners/lookup` (mentor uniquement, e-mail exact, comptes LEARNER seulement, 404 uniforme). Vérifié sur Postgres jetable : 18 tests d'intégration (dont 6 nouveaux : association d'un non-apprenant refusée, apprenant/non-membre sans accès), e2e UI (7 étapes) et ancien e2e (7 étapes) verts, `tsc`/build OK. À noter : la recherche par e-mail confirme l'existence d'un compte apprenant à un mentor (limiter le débit avec RM-009) ; pas de système d'invitation pour un apprenant non inscrit ; `routes.ts` est aussi modifié par le travail en cours dans le dossier principal (conflit de fusion possible, zones distinctes).

**Constat**

Les routes permettent de créer une roadmap et un mentorat, mais le frontend ne propose aucun écran correspondant. Un mentor ne peut pas terminer l'onboarding depuis l'application.

**Travail**

- Ajouter une page permettant au mentor de créer et consulter ses roadmaps.
- Ajouter un parcours sûr pour inviter ou rattacher un apprenant.
- Afficher les mentorats, leurs rôles et leurs statuts.
- Prévoir les états vide, chargement, erreur et conflit d'association.
- Compléter l'API si une recherche par email ou un système d'invitation est nécessaire.

**Critères d'acceptation**

- Un mentor peut créer une roadmap et y associer un apprenant sans appel API manuel.
- L'apprenant voit la roadmap après connexion.
- Un mentor ne peut pas associer un utilisateur qui n'est pas apprenant.
- Un utilisateur non membre ne peut ni voir ni modifier la roadmap.

### RM-004 — Ajouter un contexte et un sélecteur multi-roadmap

**Constat**

Le backend isole plusieurs roadmaps, mais `/roadmap` charge toutes les semaines accessibles dans une seule liste. Les créations de semaine et les sauvegardes IA n'envoient pas de `roadmapId` et échouent lorsqu'un mentor possède plusieurs roadmaps.

**Travail**

- Ajouter une roadmap active dans la navigation et l'URL.
- Charger les semaines avec `GET /api/weeks?roadmapId=...`.
- Transmettre le `roadmapId` lors des créations manuelles, clonages et sauvegardes IA.
- Isoler les clés de cache TanStack Query par roadmap.
- Recalculer la progression dans le contexte de la roadmap active.

**Critères d'acceptation**

- Un utilisateur ayant plusieurs roadmaps peut passer de l'une à l'autre sans mélange de données.
- Toute nouvelle semaine appartient explicitement à la roadmap active.
- Les mutations invalident uniquement les caches concernés.
- Les accès directs à une roadmap étrangère retournent `404`.

### RM-005 — Corriger les vulnérabilités des dépendances de production

**Constat**

`npm audit --omit=dev` remonte 48 vulnérabilités : 27 modérées, 18 élevées et 1 critique. Les chaînes concernées incluent notamment Drizzle ORM, Nodemailer, Express, `ws` et Google Cloud Storage. Certaines corrections impliquent des changements majeurs.

**Travail**

- Cartographier les vulnérabilités directes, transitives et réellement atteignables.
- Mettre à jour en priorité Drizzle ORM, Nodemailer, Express, `ws` et les dépendances de stockage.
- Traiter la vulnérabilité critique de `fast-xml-parser` dans la chaîne de stockage.
- Vérifier les changements incompatibles au lieu d'utiliser aveuglément `npm audit fix --force`.
- Documenter toute vulnérabilité résiduelle acceptée avec sa justification et son périmètre.

**Critères d'acceptation**

- Aucune vulnérabilité critique de production ne reste ouverte.
- Toute vulnérabilité élevée restante possède une analyse d'atteignabilité et une décision explicite.
- Le typage, les tests, le build et les parcours critiques restent valides après mise à jour.

### RM-006 — Introduire des migrations de base de données versionnées

> **Statut : implémenté, en attente de revue/PR — 2026-10-05.** Branche `feat/rm-006-migrations` (worktree `../roadmapmentor-rm006`, base `fix/rm-005-prod-deps`, non poussée). Livré : migration initiale (`migrations/`), scripts `db:generate` / `db:migrate`, étape `migrate` de compose, gate CI `migrations` (dérive schéma/migrations, base vide, idempotence), docs de déploiement. Vérifié sur Postgres jetable : base vide = 19 tables, rejeu sans effet, base créée par `push` refusée sans `MIGRATE_BASELINE_EXISTING=true` puis baseline OK. `shared/schema.ts` non modifié : tout changement de schéma en cours (ex. labs RM-018) doit produire sa propre migration via `npm run db:generate`. Non vérifié : exécution réelle du job CI GitHub.

**Constat**

Le dépôt utilise `drizzle-kit push` et ne contient pas de dossier de migrations. Cette méthode ne fournit pas un historique reproductible et révisable pour les déploiements de production.

**Travail**

- Générer une migration initiale représentant le schéma actuel.
- Définir la procédure de création, révision et application des migrations suivantes.
- Ajouter un contrôle CI qui construit une base vide à partir des migrations.
- Définir la stratégie de sauvegarde et de migration des installations existantes.
- Conserver la migration du domaine legacy comme étape explicite si elle reste nécessaire.

**Critères d'acceptation**

- Une base vide peut être créée uniquement avec les migrations versionnées.
- Une base existante peut être mise à niveau sans perte de données.
- Les migrations sont exécutées comme étape de release séparée de l'application.
- La documentation de déploiement décrit sauvegarde, application et reprise sur erreur.

## P1 — Bêta publique fiable

### RM-007 — Ajouter les tests d'intégration API et les parcours E2E

> **Statut : terminé — 2026-10-07.**
> **Comment :** `test/integration/support/api.ts` (acteurs, fixture de mentorat, matrice d'accès `expectAccess`) ; suites `weeks-crud`, `sessions`, `change-requests`, `billing` et isolation de deux roadmaps ; E2E scindé en `test/e2e/learner.e2e.py` et `mentor.e2e.py` ; job CI `integration` (serveur de développement, puis build de production) ; `npm run test:access-mutation`. Voir `docs/engineering/testing.md`.
> **Preuve :** 103 tests d'intégration verts sur le serveur de développement, 73 sur le build de production (suites nouvelles), 9 étapes E2E vertes sur le build de production, 5 mutations de gardes d'accès détectées.
> **Reste (hors périmètre) :** les anciennes suites s'appuient encore sur `mentor@test.com` (développement seulement) ; `roadmaps-ui.e2e.py` n'est pas en CI ; la CI n'a pas encore tourné sur GitHub.

**Constat**

Les tests unitaires ne couvraient pas les routes avec une vraie base ni les parcours navigateur.

**Travail**

- [x] Lancer PostgreSQL dans l'environnement de test (service `postgres` + proxy dans le job CI `integration`).
- [x] Tester inscription, connexion et autorisations sur les routes réelles.
- [x] Tester l'isolation de deux roadmaps et de deux apprenants.
- [x] Tester le CRUD des semaines et la sauvegarde atomique d'une roadmap IA.
- [x] Tester demandes de changement, séances, facturation et paiements.
- [x] Ajouter au moins deux parcours E2E : mentor et apprenant.

**Critères d'acceptation**

- [x] Les scénarios critiques échouent si une vérification d'accès est retirée (`npm run test:access-mutation`).
- [x] Les tests sont reproductibles en CI (acteurs uniques par exécution, base jetable de service).
- [x] Les parcours mentor et apprenant s'exécutent sur un build proche de la production.

### RM-008 — Renforcer le cycle de vie de l'authentification

**Constat**

Le middleware fait confiance au rôle contenu dans un JWT valable sept jours et ne recharge pas l'utilisateur. Le client considère le contenu de `localStorage` comme source d'identité jusqu'à la prochaine connexion.

**Travail**

- Recharger ou valider l'utilisateur courant lors des requêtes authentifiées sensibles.
- Rejeter les comptes supprimés, désactivés ou dont le rôle a changé.
- Synchroniser l'identité client avec `/api/auth/me` au démarrage.
- Nettoyer la session locale après expiration ou réponse `401`.
- Décider et documenter la stratégie de renouvellement, révocation et stockage du jeton.

**Critères d'acceptation**

- Un rôle révoqué ne reste pas actif jusqu'à l'expiration du JWT.
- Un compte désactivé perd immédiatement l'accès.
- Une session expirée ramène proprement l'utilisateur vers la connexion.

### RM-009 — Durcir la surface HTTP et les opérations coûteuses

**Travail**

- Ajouter une limitation de débit sur la connexion, l'inscription et la génération IA.
- Protéger les déclenchements de jobs et les uploads contre les abus.
- Ajouter les en-têtes de sécurité adaptés et définir une politique CSP compatible avec le frontend.
- Fixer des limites explicites pour les corps JSON et contrôler les types de fichiers uploadés.
- Ajouter des tests pour les limites et erreurs attendues.

**Critères d'acceptation**

- Les tentatives répétées d'authentification et de génération IA sont limitées.
- Les uploads dépassant les limites ou portant un type interdit sont rejetés.
- Les réponses publiques incluent les en-têtes de sécurité convenus.

### RM-010 — Réduire les requêtes N+1 et garantir l'unicité de la progression

> **Statut : partiel — 2026-10-06 (PR #47).** Livré : `getWeekContentsByWeekIds` (`server/storage.ts`) et `GET /api/weeks` groupé ; `toggleTaskProgress` en upsert atomique ; migration `0002` (dédoublonnage + unique `(task_id, learner_id)` + index). **Reste :** mesure du nombre de requêtes, pagination, N+1 du scheduler de rappels.

**Constat**

Le chargement des semaines effectue des requêtes imbriquées pour objectifs, tâches, progressions, commentaires et utilisateurs. La table de progression ne possède pas de contrainte unique visible sur le couple tâche/apprenant.

**Travail**

- Mesurer le nombre de requêtes et le temps de réponse sur une roadmap réaliste.
- Regrouper ou joindre les lectures nécessaires au chargement d'une roadmap.
- Ajouter les index correspondant aux principaux filtres d'accès.
- Ajouter une contrainte unique `(task_id, learner_id)` et rendre la mise à jour atomique.
- Prévoir pagination ou chargement progressif pour les grandes roadmaps.

**Critères d'acceptation**

- Le nombre de requêtes ne croît plus proportionnellement au nombre de tâches.
- Deux mises à jour concurrentes ne créent jamais deux progressions pour le même couple.
- Les résultats restent correctement filtrés par roadmap et apprenant.

### RM-011 — Rendre les tâches planifiées sûres en multi-instance

> **Statut : partiel — 2026-10-06 (PR #48/#49).** Livré : `server/scheduler.ts`, `schedulerConfig.ts`, `jobRuns.ts` ; table `scheduled_job_runs` (migration `0003`) ; créneau réclamé une seule fois (lot idempotent par créneau, un lot en échec n'est pas rejoué) ; `SCHEDULER_ENABLED/TIMEZONE/MIDWEEK_CRON/ENDWEEK_CRON`. **Reste :** métriques (RM-017), reprise d'un lot interrompu.

**Constat**

Chaque instance de l'application démarre ses propres tâches `node-cron`. Plusieurs réplicas peuvent donc envoyer les mêmes rappels plusieurs fois. Le fuseau `Europe/Paris` est codé en dur.

**Travail**

- Déplacer l'exécution vers un worker unique ou ajouter un verrou distribué.
- Ajouter une clé d'idempotence aux envois planifiés.
- Rendre horaires et fuseau configurables.
- Exposer le résultat des exécutions dans les logs et métriques.

**Critères d'acceptation**

- Deux instances simultanées n'envoient qu'une notification par événement.
- Un redémarrage ne rejoue pas un lot déjà traité.
- Les horaires sont configurables sans modification du code.

### RM-012 — Ajouter un stockage objet partagé pour la production

> **Statut : terminé, sauf validation contre un vrai bucket — 2026-10-06.**
> **Comment :** `S3ObjectStorageAdapter` (`server/objectStorage.ts`, `OBJECT_STORAGE_PROVIDER=s3`), ACL en métadonnées d'objet, téléversement proxifié (pas de CORS), script idempotent `npm run storage:migrate`, procédure et rétention dans `docs/deployment.md`.
> **Preuve :** tests unitaires avec client S3 simulé (`test/object-storage-adapter.test.ts`). **Reste :** test réel sur S3/MinIO.

**Constat**

Le stockage sur disque fonctionne sur un hôte unique. Il ne convient pas à plusieurs instances et nécessite une sauvegarde séparée. L'adaptateur Replit conserve une dépendance Google Cloud importante.

**Travail**

- Implémenter un adaptateur S3 compatible ou celui du fournisseur retenu.
- Conserver les chemins canoniques `/objects/...` et les règles ACL existantes.
- Ajouter une procédure de migration entre fournisseurs.
- Documenter sauvegarde, rétention et suppression des preuves.

**Critères d'acceptation**

- Deux instances accèdent aux mêmes objets.
- Les objets privés restent réservés à leur propriétaire autorisé.
- Le changement de fournisseur ne modifie pas les URL persistées en base.

### RM-018 — Ajouter des labs guidés et leur workflow de validation

**Statut : en cours — première tranche fusionnée le 2026-10-06 (migration `0004_labs.sql`, labs et soumissions dans le chargeur groupé). Non testé en navigateur : labs Python.**

**Constat**

Le projet ne possède pas de modèle de lab. Les exercices sont actuellement représentés par des objectifs `ALGO`, des tâches et une capture d'écran de réussite. Cette structure ne permet pas de présenter une pratique guidée complète, de suivre une soumission ni de demander des corrections.

**Travail**

- Ajouter une entité `labs` rattachée à une semaine, avec une extension future possible vers un objectif précis.
- Stocker titre, objectif andragogique, consignes, difficulté, durée estimée et ordre d'affichage.
- Permettre de rattacher un dépôt de départ et une URL de lancement pour les sujets qui demandent un serveur, une base de données ou plusieurs services.
- Exécuter les premiers labs Python directement dans le navigateur avec `react-py`/Pyodide, un code de départ et des assertions automatisées.
- Ajouter les soumissions apprenant avec les statuts `IN_PROGRESS`, `SUBMITTED`, `APPROVED` et `CHANGES_REQUESTED`. L'absence de soumission représente `NOT_STARTED`.
- Permettre au mentor de commenter, valider ou demander des corrections.
- Étendre la génération IA pour proposer un brouillon de lab que le mentor doit réviser avant publication.

**Rôle andragogique**

- Utiliser un lab juste après l'introduction d'une notion pour vérifier que l'apprenant sait l'appliquer sans attendre le livrable final.
- Privilégier les cas courts et observables : syntaxe, algorithme, transformation de données, appel d'API, requête, débogage ou remédiation ciblée.
- Ne pas remplacer une ressource passive par un lab : la ressource sert à comprendre, la tâche précise le travail, le lab fait pratiquer et le livrable combine plusieurs acquis dans un projet.
- Viser par semaine un ou deux micro-labs de 15 à 30 minutes, puis au besoin un lab principal de 45 à 90 minutes avant le livrable.
- Utiliser la sandbox Python intégrée pour les exercices autonomes. Utiliser un dépôt ou un environnement externe pour FastAPI, PostgreSQL et les exercices multi-services.

**Découpage de livraison**

1. **Tranche 1 — en cours** : modèle `labs`/`lab_submissions`, CRUD mentor, publication, affichage hebdomadaire, exécution Python dans le navigateur, sauvegarde et soumission, validation simple par le mentor.
2. **Tranche 2** : retour mentor rédigé dans l'interface, identité complète de l'apprenant dans la liste des soumissions, historique des tentatives et métriques de progression.
3. **Tranche 3** : modèles de labs FastAPI/PostgreSQL basés sur des dépôts réutilisables et liens de lancement externes.
4. **Tranche 4** : génération assistée par IA, prévisualisation mentor et bibliothèque de labs réutilisables.

**Critères d'acceptation**

- Un mentor peut créer, ordonner, modifier et supprimer un lab dans une semaine.
- Un apprenant peut lire les instructions, modifier et exécuter le code Python, voir le résultat des tests, sauvegarder un brouillon et soumettre sa solution.
- Le mentor peut approuver la soumission ou demander des corrections avec un commentaire.
- Les données d'un lab et de ses soumissions respectent les droits de la roadmap et du mentorat.
- La progression distingue clairement visionnage, tâches, labs et livrable final.
- Les labs générés par IA restent en brouillon tant qu'un mentor ne les a pas validés.

### RM-019 — Lire les vidéos et ressources compatibles dans l'application

**Constat**

Le type de ressource `VIDEO` existe déjà, mais toutes les ressources s'ouvrent dans un nouvel onglet. Le modèle ne stocke ni fournisseur, ni durée, ni description andragogique, ni caractère obligatoire.

**Travail**

- Étendre les ressources avec description, fournisseur, durée estimée, ordre et caractère obligatoire ou facultatif.
- Détecter et normaliser côté serveur les URL YouTube et Vimeo prises en charge.
- Ajouter un lecteur vidéo intégré, responsive et accessible dans le détail de la semaine.
- Afficher les PDF compatibles dans une visionneuse interne et conserver un lien externe de secours.
- Afficher les articles et documentations sous forme de fiche avec résumé et ouverture externe.
- Refuser l'intégration iframe de domaines arbitraires ; utiliser une liste de fournisseurs autorisés et une politique CSP adaptée.
- Ajouter une action explicite « Marquer comme vue » ; ne pas prétendre qu'une vidéo est terminée sans signal fiable du lecteur.
- Vérifier les liens proposés par l'IA et laisser le mentor les approuver avant publication.

**Critères d'acceptation**

- Une vidéo YouTube ou Vimeo valide peut être regardée sans quitter la semaine.
- Une ressource non intégrable reste accessible dans un nouvel onglet avec une indication claire.
- Une URL inconnue ne peut jamais devenir une iframe arbitraire.
- Le lecteur fonctionne sur mobile, au clavier et en plein écran.
- L'apprenant voit la durée, le statut obligatoire ou facultatif et son état de consultation.
- Un lien invalide ou supprimé est signalé au mentor sans casser l'affichage de la semaine.

### RM-020 — Inviter un apprenant par e-mail avec inscription par lien

> **Statut : terminé — 2026-10-07.**
> **Comment :** table `invitations` (migration `0005`, additive), jeton aléatoire 32 octets dont seul le sha256 est stocké, expiration dérivée de `expires_at` (`INVITATION_TTL_HOURS`, 72 h par défaut). Code : `server/data/invitations.ts`, `server/services/invitations.ts` + `invitationTokens.ts`, `server/routes/invitations.ts`, `GoneError` → 410 `{reason}`, limiteur `invitation` (`RATE_LIMIT_INVITATION_*`, 30/h par utilisateur) ; acceptation publique limitée par le limiteur `auth`. Acceptation en une transaction (`FOR UPDATE`) : compte `LEARNER` + préférences + mentorat + jeton consommé ; schéma strict sans `role` ni `email`. Un renvoi fait tourner le jeton (l'ancien lien meurt) ; relancer une invitation en attente est idempotent. E-mail d'un apprenant existant : rattachement direct ; e-mail d'un mentor : 409. L'envoi n'est pas journalisé dans `email_notifications` (user_id obligatoire) : suivi par `send_count` / `last_sent_at` ; un échec SMTP renvoie `emailSent:false` sans annuler l'invitation. UI : `/invite/:token` (`invite-page.tsx`), bouton « Inviter par e-mail » et liste des invitations (renvoyer / révoquer) sur `/roadmaps`.
> **Preuve :** `tsc` propre, 95 tests unitaires, 126 tests d'intégration (dont 23 d'invitations : idempotence, usage unique, expiration, révocation, concurrence, matrice d'accès), `npm run build`, parcours `test/e2e/invite.e2e.py` sur build de production, double `db:migrate` sans écriture.
> **Reste :** envoi SMTP réel non testé ; le journal d'envoi dédié aux invitations n'existe pas.

**Constat**

Depuis RM-003, un mentor ne peut rattacher qu'un apprenant déjà inscrit. Un apprenant inconnu doit d'abord créer son compte lui-même.

**Travail**

- Table `invitations` (migration RM-006) : e-mail, roadmap, mentor, hash du jeton (jamais le jeton en clair), expiration, usage unique, statut.
- Le mentor saisit un e-mail non inscrit sur `/roadmaps` : envoi d'un lien via `emailService` (lien `APP_URL/invite/<jeton>`).
- Page publique d'acceptation : e-mail verrouillé, saisie du nom et du mot de passe uniquement ; création du compte `LEARNER` et du mentorat dans une transaction, jeton consommé.
- Invitation expirée, déjà utilisée ou révoquée : message clair ; le mentor peut renvoyer ou révoquer.
- Si l'e-mail est déjà un apprenant : rattachement direct (comportement RM-003).

**Critères d'acceptation**

- Un apprenant invité arrive connecté sur la roadmap après avoir renseigné uniquement nom et mot de passe.
- Le jeton est à usage unique, expire, et est stocké haché.
- L'invitation ne peut jamais créer un compte MENTOR.
- Limitation de débit sur la création d'invitation et l'acceptation (avec RM-009).

**Conception / ordre**

- Code dans un module dédié (`server/routes/invitations.ts` + service), pas dans le monolithe `routes.ts` (cf. RM-013).
- Dépend de la fusion de RM-006 (migrations) : branche à créer après intégration de `feat/rm-006-migrations`.

## P2 — Maintenabilité et passage à l'échelle

### RM-013 — Découper les monolithes backend

> **Statut : terminé — 2026-10-06.**
> **Comment :** `server/routes.ts` (2 682 lignes) est un simple compositeur de 37 lignes ; 14 modules de routes par domaine dans `server/routes/` (`registerXRoutes(app, deps)`), contrôles d'accès partagés dans `server/access/` (`weekAccess`, `mentorshipAccess`), workflow de facturation dans `server/services/billingPeriods.ts`. `server/storage.ts` (1 268 lignes) est une façade de 4 lignes : un dépôt par agrégat dans `server/data/` (interface `XStore` + classe), composés par `createStorage()` qui refuse les noms de méthode dupliqués ; l'objet `storage` et ses 85 méthodes sont inchangés pour les appelants, les transactions restent dans leur dépôt, les appels inter-agrégats passent par `this.store()`. Erreurs métier typées (`server/domain/errors.ts`: `NotFoundError` 404, `InvalidRequestError` 400, `ConflictError` 409) converties en un seul endroit (`server/http/errors.ts`) ; plus de reconnaissance par texte de message dans les routes.
> **Preuve :** découpage mécanique par script, 67 routes avant/après, 85 méthodes de stockage avant/après ; `tsc`, 91 tests unitaires, 30 tests d'intégration sur serveur frais et build verts. **Reste :** `RM-007` (CRUD semaines…) reste listé comme dépendance dans le tableau mais n'a pas bloqué ce travail.

**Constat**

`server/routes.ts` dépasse 2 400 lignes et `server/storage.ts` dépasse 1 000 lignes.

**Travail**

- Découper les routes par domaine : authentification, roadmap, mentorat, facturation, notifications, objets et IA.
- Créer des services applicatifs pour les workflows métier multi-étapes.
- Découper les accès aux données par agrégat sans perdre les transactions.
- Centraliser la conversion des erreurs métier en réponses HTTP.

**Critères d'acceptation**

- Chaque domaine peut être compris et testé indépendamment.
- Les contrôles d'accès restent partagés et obligatoires.
- Les tests d'intégration garantissent l'absence de régression pendant le découpage.

### RM-014 — Réduire le poids du frontend et des médias

> **Statut : livré — 2026-10-07.** Image de fond 13,8 MB → 29 kB (WebP 1920 px), médias inutilisés de `public/` supprimés, pages chargées à la demande (`React.lazy`), bundle initial 692 → 281 kB ; budget vérifié par `npm run check:bundle` (JS 400 kB/chunk, CSS 150 kB, média 500 kB, surchargeables) et étape CI.

**Constat**

Le build produit un bundle JavaScript principal d'environ 662 kB minifié et une image d'environ 13,8 MB.

**Travail**

- Convertir et redimensionner les images lourdes avec des formats modernes.
- Charger les pages secondaires avec des imports dynamiques.
- Séparer les dépendances lourdes dans des chunks adaptés.
- Mesurer le chargement initial avant et après changement.

**Critères d'acceptation**

- Aucun média de décoration ne dépasse le budget défini par l'équipe.
- Le bundle initial passe sous le budget de performance convenu.
- Les pages mentorat et préférences sont chargées à la demande.

### RM-015 — Nettoyer les dépendances et avertissements d'outillage

> **Statut : terminé, avec deux avertissements amont acceptés — 2026-10-07.**
> **Comment :** 20 paquets sans usage retirés (session/passport, `resend`, `framer-motion`, `react-icons`, `next-themes`, `google-auth-library`, `p-limit`, `zod-validation-error`, `tw-animate-css`, `@tailwindcss/vite` v4 incompatible avec Tailwind 3, présigneur S3, `@jridgewell/trace-mapping` et leurs `@types`) ; `nanoid` (utilisé par `server/index-dev.ts`) déclaré en devDependency ; base caniuse mise à jour ; scripts d'installation natifs arbitrés dans `allowScripts` (esbuild autorisé, `bufferutil` refusé : accélération optionnelle de `ws`). Tailwind reste en 3.4 (cohérent avec `tailwindcss-animate` et `@tailwindcss/typography`).
> **Preuve :** `npm ci` sans avertissement `install-scripts`, `npm run build`, `tsc`, 95 tests unitaires.
> **Reste (amont) :** l'avertissement PostCSS « `from` » vient du plugin Tailwind 3.4 (isolé par bissection ; disparaît avec une migration Tailwind 4) ; dépréciations `@esbuild-kit/*` (drizzle-kit) et `node-domexception` (transitives).

**Travail**

- Retirer les paquets inutilisés, notamment les anciens restes de session ou d'intégrations remplacées.
- Mettre à jour les données Browserslist et Baseline.
- Identifier le plugin PostCSS qui omet l'option `from`.
- Réviser les scripts d'installation natifs nécessaires au build.
- Aligner clairement les versions Tailwind et leurs plugins.

**Critères d'acceptation**

- `npm ci` et `npm run build` ne produisent plus d'avertissements évitables.
- Chaque dépendance directe possède un usage identifié.
- Le build reste reproductible à partir du lockfile.

### RM-016 — Implémenter réellement l'infrastructure cloud Terraform

**Constat**

Les modules Terraform actuels décrivent des contrats typés, mais ne créent encore aucune ressource fournisseur.

**Travail**

- Choisir le premier fournisseur et implémenter réseau, calcul, stockage et secrets.
- Configurer un backend d'état distant et son verrouillage.
- Définir les environnements staging et production.
- Ajouter plans automatiques, revue et procédure d'application contrôlée.
- Brancher sondes de santé, volumes et variables de l'application.

**Critères d'acceptation**

- Un environnement staging complet peut être provisionné de façon reproductible.
- Aucun secret ni état Terraform n'est stocké dans Git.
- Le plan de production est révisable avant toute application.

### RM-017 — Ajouter observabilité, alertes et procédures d'exploitation

**Travail**

- Structurer les logs avec identifiant de requête et contexte utilisateur non sensible.
- Mesurer latence, erreurs HTTP, connexions base, emails, jobs et appels IA.
- Ajouter des alertes sur indisponibilité, échecs récurrents et files de notifications.
- Écrire des procédures pour incident, restauration et rotation des secrets.

**Critères d'acceptation**

- Une erreur utilisateur peut être reliée à une requête serveur sans exposer de secret.
- Les échecs de base, email, stockage et IA sont visibles et alertés.
- Une restauration de sauvegarde est testée avant la mise en production.

## Ordre de livraison recommandé

1. **Stabilisation immédiate** : RM-001, RM-005 et RM-006.
2. **Onboarding utilisable** : RM-002, RM-003 et RM-004.
3. **Expérience andragogique** : RM-018 et RM-019.
4. **Bêta fiable** : RM-007, RM-008, RM-009 et RM-010.
5. **Exploitation multi-instance** : RM-011 et RM-012.
6. **Industrialisation** : RM-013 à RM-017.

## Définition de terminé commune

Un élément est terminé lorsque :

- ses critères d'acceptation sont vérifiés ;
- les contrôles `npm run check`, `npm test` et `npm run build` passent ;
- les changements de schéma, configuration ou exploitation sont documentés ;
- les nouveaux comportements sensibles possèdent des tests de non-régression ;
- aucune donnée secrète ou configuration propre à une machine n'est ajoutée au dépôt.
