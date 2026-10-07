# Tests d'intégration et E2E

## Suites

| Niveau | Commande | Base requise |
| --- | --- | --- |
| Unitaires | `npm test` | non |
| API (vraies requêtes HTTP) | `TEST_BASE_URL=http://localhost:5055 npm run test:integration` | PostgreSQL jetable + proxy WebSocket, `npm run db:migrate` |
| Parcours navigateur | `TEST_BASE_URL=... python test/e2e/learner.e2e.py` puis `mentor.e2e.py` | idem + Playwright |
| Contrôles d'accès (mutation) | `npm run test:access-mutation` | idem, `JWT_SECRET` exporté |

`DATABASE_URL`, `DATABASE_WS_PROXY`, `DATABASE_WS_PROXY_INSECURE=true` et `JWT_SECRET` doivent être exportés ; ajouter `RATE_LIMIT_AUTH_MAX=1000` et `RATE_LIMIT_INVITATION_MAX=1000` au serveur testé (les suites enchaînent beaucoup de connexions).

## Conventions

- Helpers communs : `test/integration/support/api.ts` (`api`, `register`, `ensureMentor`, `mentoringFixture`, `createPackage`, `track`/`registerCleanup`, `expectAccess`).
- `ensureMentor` passe par `scripts/create-mentor.ts` : il fonctionne sur un serveur de développement **et** sur un build de production (la route `create-test-users` n'existe qu'en développement). Les anciennes suites (`mentor@test.com`) restent limitées au serveur de développement.
- Chaque suite crée ses propres acteurs (adresses suffixées par un identifiant d'exécution) : pas de collision, base jetable.
- Toute route protégée déclare sa matrice avec `expectAccess` : une ligne = un test nommé d'après la route et l'acteur. Statuts : 401 sans jeton, 403 mauvais rôle, 404 hors périmètre (mentorat, roadmap, semaine non validée).

## Vérifier qu'un contrôle d'accès est protégé

`npm run test:access-mutation` affaiblit tour à tour cinq gardes (`scripts/access-mutation-check.ts`), lance la suite correspondante et exige qu'elle échoue ; les fichiers sont restaurés ensuite. Lent (un démarrage de serveur par mutation) : à lancer à la main avant de modifier des règles d'accès, pas en CI. Ajouter une entrée à la liste quand une nouvelle garde apparaît.

## CI

Le job `integration` (gate `integration`, déclenchée par backend, shared, schéma, outillage et `test/integration/**`, `test/e2e/**`) exécute les migrations, la suite API sur le serveur de développement, puis, sur le build de production, les suites qui n'utilisent que `ensureMentor` et les deux parcours navigateur.
