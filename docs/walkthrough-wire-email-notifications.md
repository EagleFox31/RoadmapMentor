# Walkthrough — Brancher les e-mails déjà écrits mais jamais envoyés

> Travail réalisé par l'IA intervenante à la demande explicite de l'utilisateur : laisser les mails existants, brancher ce qui restait débranché.

## Ce qui a été trouvé

Les gabarits existent dans `server/services/emailService.ts`. Déjà envoyés en prod : OTP, invitation, commentaire (mentor), progression (mentor, à chaque tâche), screenshot, rappel mercredi/vendredi, IA.

Jamais appelés depuis un vrai événement :

- validation de semaine ;
- nouvelle tâche ;
- semaine modifiée ;
- jalon 25/50/75/100 % ;
- rappel mentor « préparer la semaine suivante » (présent seulement dans le job de test) ;
- deadline J-2.

Non branchés **volontairement** : badges, série (streak), rapport hebdomadaire. Il n’y a pas de table de badges, pas de calcul de série, pas d’heures passées. Inventer des zéros dans le mail serait un mensonge.

Fichiers d’un autre agent (`week-selector`, `auth.ts`, viewer PDF, keepalive, images) non touchés, sauf `content.ts` : uniquement l’envoi « nouvelle tâche » sur la route existante, sans toucher à l’upload document en cours.

## Ce qui a été modifié

- `server/services/notifyWeekLearners.ts` : destinataires = apprenants du mentorat de la roadmap.
- `server/services/milestones.ts` + `test/milestones.test.ts` : franchissement 25/50/75/100.
- `server/services/weekDeadlines.ts` + `test/week-deadlines.test.ts` : J-2 sur `endDate`.
- `server/routes/weeks.ts` : validation → `sendWeekValidation` ; mise à jour d’une semaine déjà visible → `sendWeekModified`.
- `server/routes/content.ts` : création de tâche sur une semaine validée → `sendNewTaskAssigned`.
- `server/routes/progress.ts` : jalon roadmap (en plus du mail mentor déjà en place).
- `server/scheduler.ts` + `server/jobs/emailNotifications.ts` : deadline J-2 à chaque créneau ; préparation mentor le vendredi (`task-reminder-endweek`).

Les gabarits HTML et les envois déjà câblés ne changent pas.

## Statut

Code en place. L’envoi réel dépend de `RESEND_API_KEY` / `MAIL_FROM` (déjà utilisés pour l’OTP). Un échec Resend est journalisé `failed` et n’empêche pas la requête HTTP.

## Comment cela a été testé

- `npx tsx --test test/milestones.test.ts test/week-deadlines.test.ts`
- `npm test` (suite unitaire)
- `npm run check`

Pas de parcours navigateur : aucun écran changé. Les routes d’intégration existantes (valider une semaine, cocher une tâche) restent les mêmes ; elles déclenchent désormais un envoi en plus.

## Idées d’innovation

- Rapport hebdo et séries quand on saura compter les heures / jours d’activité (`doneAt` existe déjà).
- Ne pas écrire dans `content.ts` mêlé à l’upload PDF d’un autre agent : extraire l’upload dès que cette PR-là est fusionnée.
