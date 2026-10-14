# Walkthrough — Tous les e-mails sur le gabarit OTP

> Travail réalisé par l'IA intervenante à la demande explicite de l'utilisateur.

## Ce qui a été trouvé
OTP et invitation passaient déjà par `renderBrandedEmail`. Les autres (commentaire, progression, validation, rappels, jalons, etc.) gardaient un HTML à part : dégradés, emojis en bandeau, noms non échappés.

## Ce qui a été modifié
- `server/services/emailLayout.ts` : carte de mise en avant, barre de progression, lien Préférences dans le pied.
- `server/services/emailTemplates.ts` : un builder par type d’alerte, même carte / bouton / signature que l’OTP. Textes utilisateur passés par `escapeHtml`.
- `server/services/emailService.ts` : les `send*` ne font plus que préférences + envoi. Même contrat (arguments, types `email_notifications`).
- `test/email-templates.test.ts` : échappement d’un commentaire, barre à 50 %, jalon 100 %.

Aucun écran changé. L’envoi Resend et les préférences restent identiques.

## Statut
Opérationnel côté rendu. L’envoi réel dépend toujours de `RESEND_API_KEY`.

## Comment cela a été testé
- `npx tsx --test test/email-templates.test.ts`
- `npm test`
- `npm run check`

Pas de navigateur : pas d’UI.

## Idées d’innovation
- Version texte (`text/plain`) à côté du HTML.
- Aperçu HTML figé dans `docs/` pour relire sans envoyer.
