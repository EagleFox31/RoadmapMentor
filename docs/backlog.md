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
| RM-013 | P2 | Foundation | L | Découper les monolithes `routes.ts` et `storage.ts` | RM-007 |
| RM-014 | P2 | Release | M | Réduire le poids du frontend et des médias | — |
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

> **Statut : partiel — 2026-10-05.**
> **Comment :** `npm run test:integration` (`test/integration/*.integration.ts`) lance de vraies requêtes HTTP contre un serveur de développement branché sur un PostgreSQL jetable (service `postgres` du `docker-compose.yml` + proxy WebSocket, avec `drizzle-kit push`). Le parcours mentor/apprenant y est couvert (13 tests, dont la génération IA en option avec `TEST_AI=1`). Le parcours navigateur est dans `test/e2e/mentor-learner.e2e.py` (Playwright, 7 étapes : inscription UI, validation mentor, preuve par capture, commentaire, lecture mentor).
> **Pourquoi :** les tests unitaires ne voyaient aucun des défauts réels (inscription cassée, `reusePort` sous Windows, `.env` non chargé, proxy compose, visibilité des semaines). Ces suites les ont trouvés et sont documentées dans `docs/engineering/lessons-learned.md`.
> **Reste :** exécution en CI, CRUD complet des semaines, demandes de changement, séances, facturation/paiements, isolation de deux roadmaps, test sur un build de production.


**Constat**

Les 53 tests actuels valident surtout les schémas et fonctions métier. Ils ne couvrent pas les routes avec une vraie base ni les parcours navigateur.

**Travail**

- [x] Lancer PostgreSQL dans l'environnement de test. (en local via docker compose ; pas encore en CI)
- [x] Tester inscription, connexion et autorisations sur les routes réelles.
- [ ] Tester l'isolation de deux roadmaps et de deux apprenants. (deux apprenants : fait ; deux roadmaps : à faire)
- [ ] Tester le CRUD des semaines et la sauvegarde atomique d'une roadmap IA. (sauvegarde atomique IA : faite ; CRUD : à faire)
- [ ] Tester demandes de changement, séances, facturation et paiements.
- [ ] Ajouter au moins deux parcours E2E : mentor et apprenant. (un scénario e2e couvrant mentor et apprenant ; à scinder en deux parcours)

**Critères d'acceptation**

- [ ] Les scénarios critiques échouent si une vérification d'accès est retirée.
- [ ] Les tests nettoient leurs données et sont reproductibles en CI. (isolation par identifiants uniques ; base jetable, pas encore de nettoyage ni de CI)
- [ ] Les parcours mentor et apprenant s'exécutent sur un build proche de la production.

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

## P2 — Maintenabilité et passage à l'échelle

### RM-013 — Découper les monolithes backend

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
3. **Bêta fiable** : RM-007, RM-008, RM-009 et RM-010.
4. **Exploitation multi-instance** : RM-011 et RM-012.
5. **Industrialisation** : RM-013 à RM-017.

## Définition de terminé commune

Un élément est terminé lorsque :

- ses critères d'acceptation sont vérifiés ;
- les contrôles `npm run check`, `npm test` et `npm run build` passent ;
- les changements de schéma, configuration ou exploitation sont documentés ;
- les nouveaux comportements sensibles possèdent des tests de non-régression ;
- aucune donnée secrète ou configuration propre à une machine n'est ajoutée au dépôt.
