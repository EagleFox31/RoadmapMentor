# Flux d'invitation des mentors — proposition

> Rédigé le 2026-10-13. Reco basée sur recherche standards B2B SaaS 2025 (Auth0, Better Auth, Achromatic, Unleash, Hatz).

## Problème

Actuellement, l'inscription publique crée systématiquement un `LEARNER` ([server/routes/auth.ts:34](../server/routes/auth.ts#L34), [server/routes/auth.ts:129](../server/routes/auth.ts#L129)). Les `MENTOR` sont promus à la main en base (`update users set role='MENTOR' …`). Pas de super-admin UI. Ça ne scale pas et n'est pas auditable.

## Reco : invitation par token, pas de signup public pour les rôles élevés

Modèle standard B2B 2025 : **token email-bound, single-use, expirant**, émis depuis un panel admin.

### Architecture

1. **LEARNER** — seule inscription publique (comportement actuel), OU invitation par un mentor (recommandé pour lier learner↔mentor dès l'inscription).
2. **MENTOR** — invitation uniquement, émise par un `ADMIN` depuis un panel `/admin`.
3. **ADMIN** — nouveau rôle, seedé en base manuellement, pas d'inscription possible.

### Mécanique du token

Table `invitations` :
- `email`
- `role` (`MENTOR` | `LEARNER`)
- `token` (hash SHA-256, jamais stocké en clair)
- `invited_by` (fk users)
- `expires_at` (7 jours)
- `accepted_at`
- `status` (`pending` | `accepted` | `expired` | `revoked`)

Flux :
- Lien : `/invite/<token>` → page qui affiche le rôle attribué + e-mail pré-rempli + flux OTP existant.
- À l'acceptation (OTP confirmé sur la même adresse), user créé avec le bon rôle.
- Token **révocable**, **single-use**, **email-bound** (ne marche que si l'OTP valide la même adresse que celle de l'invitation).

### Panel admin minimal (`/admin/invitations`)

- Liste des invitations (pending / accepted / expired / revoked).
- Bouton « Inviter mentor » → formulaire e-mail + envoi.
- Révocation en 1 clic.

## Pourquoi cette version

- **Standard du marché** (Auth0, Better Auth, Unleash) : token single-use + email + expiry = sécurité & auditabilité.
- **Zéro régression** sur le flux OTP existant : le token d'invitation est juste une pré-condition qui fixe le rôle à la création.
- **Évolutif** : plus tard, un mentor peut inviter ses learners avec le même mécanisme (`role=LEARNER`, `invited_by=<mentor_id>` → lien mentor↔learner automatique).

## Effort estimé

Une PR focalisée :
- Migration + table `invitations` + schéma Drizzle.
- Routes `POST /api/admin/invitations`, `DELETE /api/admin/invitations/:id`, `GET /api/invitations/:token`, `POST /api/invitations/:token/accept`.
- Page `/admin/invitations` (liste + formulaire).
- Page `/invite/:token` (acceptation + OTP).
- Ajout rôle `ADMIN` dans `shared/schema.ts` + seed.

Pas de refonte UI du reste de l'app.

## Pré-requis avant implémentation

1. Commiter d'abord les travaux en cours (OTP + responsive mentoré) — cf. [PASSATION.md](../PASSATION.md).
2. Décider : un seul ADMIN seedé (toi), ou plusieurs ADMIN gérables depuis le panel ?

## Sources

- [Auth0 — Onboarding strategies B2B SaaS](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/)
- [Better Auth — Invite plugin](https://www.mintlify.com/0-Sandy/better-auth-invite-plugin/guides/creating-invites)
- [Achromatic — Organization invitations](https://www.achromatic.dev/docs/monorepo-next-prisma-authjs/organizations/invitations)
- [Unleash — Public signup tokens](https://docs.getunleash.io/concepts/public-signup.md)
- [Hatz — Invite links & automatic account creation](https://docs.hatz.ai/en/articles/14503323-invite-links-automatic-account-creation)
