# Cycle de vie de la session (RM-008)

## Stratégie

- **Jeton** : JWT signé, durée 7 jours, stocké dans `localStorage` (`jwt_token`). Choix conservé pour la bêta : application mono-origine sans cookie, risque XSS limité par l'absence de HTML injecté ; à réévaluer si un cookie `HttpOnly` devient nécessaire.
- **Source de vérité** : la base. À chaque requête authentifiée, `authMiddleware` recharge l'utilisateur. Un compte supprimé, ou dont le rôle ne correspond plus à celui du jeton, reçoit `401` immédiatement, sans attendre l'expiration.
- **Client** : au démarrage, `GET /api/auth/me` aligne l'identité locale (rôle, nom) avant l'affichage des pages protégées. Tout `401` sur une session ouverte (hors `/api/auth/login` et `/api/auth/register`) vide la session locale et ramène à `/`.
- **Renouvellement** : aucun refresh token ; reconnexion à l'expiration. **Révocation** : suppression du compte ou changement de rôle (effet immédiat). Pas de liste de jetons révoqués.

## Reste à faire

- Compte désactivé : exige une colonne (`disabled_at`) donc une migration (RM-006) ; le contrôle se branchera dans `createAuthMiddleware`.
- Coût : une lecture par requête. Mettre en cache court si la mesure l'exige (RM-010).
