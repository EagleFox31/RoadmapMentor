# Cycle de vie de la session (RM-008)

## Stratégie

- **Jeton** : JWT signé, durée 7 jours, stocké dans `localStorage` (`jwt_token`). Choix conservé pour la bêta : application mono-origine sans cookie, risque XSS limité par l'absence de HTML injecté ; à réévaluer si un cookie `HttpOnly` devient nécessaire.
- **Source de vérité** : la base. À chaque requête authentifiée, `authMiddleware` recharge l'utilisateur. Un compte supprimé, désactivé (`users.disabled_at`), ou dont le rôle ne correspond plus à celui du jeton, reçoit `401` immédiatement, sans attendre l'expiration.
- **Client** : au démarrage, `GET /api/auth/me` aligne l'identité locale (rôle, nom) avant l'affichage des pages protégées. Tout `401` sur une session ouverte (hors `/api/auth/login` et `/api/auth/register`) vide la session locale et ramène à `/`.
- **Renouvellement** : aucun refresh token ; reconnexion à l'expiration. **Révocation** : suppression du compte ou changement de rôle (effet immédiat). Pas de liste de jetons révoqués.

## Désactiver un compte

```bash
npm run user:set-status -- --email=<email> --action=disable   # ou enable
```

Idempotent (second appel = aucune écriture), journal d'audit sur la sortie standard. Un compte désactivé perd l'accès à sa prochaine requête et ne peut plus se connecter (même réponse `401 Invalid credentials` qu'un mauvais mot de passe).

## Reste à faire

- Coût : une lecture par requête. Mettre en cache court si la mesure l'exige (RM-010).
