# Observabilité

## Journaux
- Une ligne JSON par événement (`ts`, `level`, `event`, …) sur stdout (stderr pour `error`), via `logEvent` (`server/http/observability.ts`).
- `http_request` : `requestId`, `method`, `route` (modèle de route, jamais le chemin brut ni la query), `status`, `durationMs`, `userId`, `role`. Aucun corps de requête ni de réponse.
- `api_error` / `unhandled_error` : erreur 500 avec `requestId`, `errorName`, `errorMessage`, `stack`.

## Identifiant de requête
- Chaque requête reçoit `x-request-id` (repris du proxy s'il respecte `[A-Za-z0-9._-]{8,64}`, sinon UUID) renvoyé dans l'en-tête de réponse.
- Les réponses 500 contiennent `requestId` : l'utilisateur peut le communiquer, on retrouve la ligne de log correspondante.

## Mesures (à partir des logs)
Latence = `durationMs`, erreurs HTTP = `status`, par `route`. Alertes et agrégation : à brancher avec l'infrastructure (RM-016).
