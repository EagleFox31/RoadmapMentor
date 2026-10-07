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

## Erreurs HTTP
- Format des erreurs `/api` (statut ≥ 400) : `{ error, code, message, requestId }`. `error` (anglais) est le champ historique, inchangé ; `code` est stable et lisible par la machine ; `message` est en français et affichable à l'utilisateur ; `requestId` relie l'erreur aux logs.
- Patterns : hiérarchie d'erreurs métier (`server/domain/errors.ts`) traduite en HTTP par `handleError` ; **catalogue** `server/http/errorCatalog.ts` (message anglais → code + message français, repli par statut) ; **décorateur de réponse** `errorEnvelope` qui enrichit toute erreur `/api` sans modifier les routes.
- Ajouter une erreur : l'écrire dans `BY_MESSAGE` (ou `NOUNS` pour un « X not found »). Sans entrée, le repli par statut s'applique.
- Couvert aussi : JSON mal formé (400 `MALFORMED_JSON`), corps trop gros (413), route `/api` inconnue (404 JSON `ROUTE_NOT_FOUND`).
- Côté client, `ApiError` (`client/src/lib/queryClient.ts`) expose `status`, `code`, `reason`, `requestId` ; les 5xx affichent une référence courte.
- Les réponses d'erreur ne doivent jamais différer entre « compte inexistant » et « compte non visible » (hors `requestId`).
