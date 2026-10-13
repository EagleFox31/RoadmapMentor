# Recherche — Notifications commentaires et bilan mi-semaine (mentorat / apprentissage adulte)

> Accès : 13 octobre 2026. Question : que font les produits du domaine pour (1) commenter / discuter entre mentor et mentoré, (2) notifier in-app et par e-mail, (3) présenter l’avancement en cours de semaine aux deux parties ?
>
> Périmètre RoadmapMentor : OS mentor indépendant, pas un LMS d’entreprise ni un marketplace de matching. Vocabulaire : andragogie.

## Décision / hypothèse testable

**H1.** Un commentaire est un événement *conversationnel* : l’autre partie (et seulement elle) reçoit un inbox in-app **et** un e-mail contenant un extrait, avec préférence désactivable.

**H2.** Un mail à chaque tâche cochée n’est pas le modèle du marché. L’avancement se communique par (a) un digest hebdomadaire unique avec %, ou (b) des notes de séance partagées après un point mentor, pas par un blast par événement de progression.

**H3.** `/notifications` comme journal d’e-mails n’est pas un inbox. Les produits du domaine séparent : inbox in-app (non-lus, clic vers le fil) ≠ digest e-mail ≠ canal temps réel (push / Slack).

## Sources (date d’accès 2026-10-13)

| Source | Type | Fraîcheur | Fiabilité |
|---|---|---|---|
| [360Learning — e-mail et push](https://support.360learning.com/hc/en-us/articles/115001246386-About-email-and-push-notifications) | Doc produit, mise à jour 13 oct. 2026 | Jour J | Haute |
| [360Learning — Feedback Inbox](https://support.360learning.com/hc/en-us/articles/360060478431-Answer-posts-with-the-Feedback-Inbox) | Doc produit | Courante | Haute |
| [MentorCruise — push](https://help.mentorcruise.com/article/39-notificationsmdx) | Help center, 29 janv. 2026 | 2026 | Haute |
| [MentorCruise — app](https://mentorcruise.com/app/) | Marketing produit | Courante | Moyenne (claim vendeur) |
| [Thinkific — weekly reminder](https://support.thinkific.com/hc/en-us/articles/360030717833-Weekly-Reminder-Emails) | Doc produit | Courante | Haute |
| [Exercism — être mentoré](https://exercism.org/docs/using/feedback/guide-to-being-mentored) | Doc produit | Courante | Haute |
| [GitHub — configuring notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications) | Doc produit | Courante | Haute |
| [OpenClassrooms — Completing a session](https://openclassrooms.my.site.com/FAQ/s/article/Completing-a-session?language=en_US) | FAQ mentor | Snippet 2026 ; fetch direct a échoué | Moyenne (snippet moteur, page Salesforce) |
| [OpenClassrooms — follow student progression](https://openclassrooms.my.site.com/FAQ/s/article/How-to-follow-my-student-s-progression) | FAQ, 8 août 2025 | 2025 | Moyenne (snippet) |
| [OpenClassrooms — missed session](https://openclassrooms.my.site.com/FAQ/s/article/Dealing-with-a-missed-session?language=en_US) | FAQ | Snippet | Moyenne |
| [Together — surveys](https://help.togetherplatform.com/en-us/articles/15877907-how-to-send-your-survey) | Help center | Courante | Haute |
| [Together — scheduled emails](https://help.togetherplatform.com/en-us/articles/15877953-sending-custom-emails) | Help center | Courante | Haute |
| [Together — program health](https://help.togetherplatform.com/en-us/articles/15877758-monitoring-your-programs-health) | Help center | Courante | Haute |
| [Chronus × Slack](https://slack.com/marketplace/ATWDNFLJ1-chronus) | Marketplace | Courante | Moyenne (fiche intégration) |
| [Thinkific n’est pas CareerFoundry] ; [Course Report Thinkful vs CareerFoundry](https://www.coursereport.com/blog/career-foundry-vs-thinkful-your-complete-guide) | Presse | Non daté précisément | Moyenne |
| Duolingo weekly recap : [unsubscribe `notify_weekly_progress_report`](https://www.duolingo.com/unsubscribe) ; [r/duolingo 4 juil. 2026](https://www.reddit.com/r/duolingo/comments/1undc65/weekly_email_updates_for_time_spent_learning_have/) | Produit + témoignages | 2026 | Haute sur l’existence du type ; moyenne sur le contenu |
| [BetterUp Session Insights](https://support.betterup.com/hc/en-us/articles/46316887717915-Session-Recordings-and-Session-Insights-Member-Guide) | Help, login wall | Snippet | Basse-moyenne |

**Bloqué :** fetch OpenClassrooms Salesforce (timeout) ; BetterUp Session Insights (login). Les faits OC ci-dessous sont des extraits de résultats de recherche, pas le HTML complet.

## Ce que le marché fait vraiment

### 1. Commentaires / messages

| Produit | Qui écrit | Qui est notifié | Canal |
|---|---|---|---|
| Exercism | Mentor **et** apprenant, fil sur la solution | L’autre à chaque itération / commentaire | Inbox + e-mail (le contenu du commentaire dans le mail a été une demande historique ; l’alerte mentor à chaque itération est documentée) |
| 360Learning | Apprenant, auteur, instructeur ; mentions | Inbox Feedback **et** e-mail ; mentions non désactivables | Inbox in-app + e-mail cadencé |
| MentorCruise | Chat bidirectionnel | Push « quand la réponse arrive » ; conversations non lues en haut | App + e-mail/Zapier côté mentor |
| GitHub (analogie fil de travail) | Les deux | Inbox ; e-mail HTML+texte **avec le contenu** | Inbox 5 mois / Saved illimité |
| OpenClassrooms | Notes de **séance** rédigées par le mentor | Notes **partagées avec l’étudiant** ; commentaire privé staff **sans** notif | Artefact séance, pas un chat |
| RoadmapMentor aujourd’hui | Apprenant seulement | Mentor e-mail seulement | Pas d’inbox ; pas de réponse mentor |

Pattern convergent : **conversation à deux voix**. Un commentaire n’est pas un ticket one-shot vers le mentor. Le mail, quand il part, **contient un extrait** (360L, GitHub ; RM le fait déjà pour le mentor). L’inbox in-app est le canal de triage, pas une copie de `email_notifications`.

### 2. Cadence e-mail (anti-spam)

360Learning, doc du jour :

- mentions / réponses : au plus toutes les **5 minutes** (quasi temps réel) ;
- likes : au plus **1/h** ;
- le reste : **1 digest quotidien** 15:00 UTC ;
- option admin : bloquer les rappels le week-end.

Thinkific : **un** mail dimanche, **un** par apprenant, liste des cours incomplets + **%** + lien reprendre. L’apprenant peut se désinscrire.

Duolingo : type produit `notify_weekly_progress_report` ; recap XP / minutes / leçons vs semaine précédente (témoignage reddit 4 juil. 2026). Canal **apprenant**, pas un coach.

GitHub : inbox d’abord ; e-mail pour ce à quoi on participe. Pas de digest natif hebdo (les outils tiers existent *parce que* le per-event fatigue).

**Implication RM :** `sendProgressUpdate` à **chaque** tâche cochée est à contre-courant. Le marché batch la progression ; il réserve le quasi temps réel aux **réponses humaines**.

### 3. « Mi-parcours de la semaine » aux deux parties

Ce n’est **pas** un même objet chez tout le monde. Trois modèles distincts :

**A. Digest d’avancement (LMS / consumer learning)**  
Thinkific → apprenant, % par cours, 1/semaine. Duolingo → apprenant, stats vs semaine N-1. Pas de copie coach sauf rôle « teacher classroom » (Duolingo for Schools : le prof *voit* le progrès dans le produit, ce n’est pas le même mail).

**B. Notes de séance partagées (mentorat structuré hebdo)** — le plus proche d’un « bilan mi-semaine mentor + mentoré »  
OpenClassrooms : séance hebdo visio ; rappel e-mail **48 h avant** ; après séance, notes sous 24–48 h **visibles par l’étudiant** (sujets, objectifs SMART, % projet ; 95 % = livrable prêt, 100 % à la validation). Commentaire privé mentor → staff **sans notification**. E-mail mentor à la **validation de projet**. Suivi mi-parcours **humain** (CSM), pas un cron de %.

CareerFoundry / Thinkful (Course Report) : le rythme est la **séance** (1×/sem CF, 3×/sem Thinkful) + feedback d’exercices, pas un mail automatique de % mi-semaine documenté.

BetterUp (snippet) : après séance enregistrée, e-mail *Session Insights* (résumé, next steps) au **membre**. Le manager n’est dans la boucle que sur **opt-in**. Confidentialité explicite.

**C. Check-in de santé de binôme (logiciel de mentoring d’entreprise)**  
Together : e-mails cadencés **par rôle** (version mentor / version mentee) ; enquêtes « X mois après le match » ; table *Needs check-in* (pas de séance bookée, scores bas) → mail aux **deux**. Chronus : notifs dans Slack (mises à jour, rappels de meeting, sondages) pour rester dans l’outil du quotidien.

RoadmapMentor aujourd’hui : mercredi/vendredi = rappel **tâches ouvertes à l’apprenant seulement** ; pas de % ; pas de copie mentor. Le template `sendWeeklyReport` existe et n’est jamais appelé.

## Écart RoadmapMentor vs marché

| Capacité marché | RM | Écart |
|---|---|---|
| Inbox in-app non-lus, clic vers le fil | Journal des e-mails envoyés | Fort |
| Commentaire bidirectionnel | Apprenant → mentor only | Fort |
| Mail commentaire à l’autre partie, avec extrait | Mentor seulement | Moyen |
| Progression **batchée** (digest ou jalon) | Mail mentor à chaque tâche done | Fort (bruit) |
| Digest hebdo % vers l’apprenant | Rappel « N tâches » sans % | Moyen |
| Même briefing (ou versions rôle) aux deux | Non | Fort vs H2 utilisateur |
| Notes de séance partagées + privé staff | Absent | Produit différent (pas de séance native) |
| Rappel 48 h avant un point | Absent | Lié aux séances |
| Push / Slack / WhatsApp | E-mail seul | Local : Slack peu probable au Cameroun ; WhatsApp non recherché ici |

## Recommandation (Adopt / Adapt / Learn, pas Build from scratch)

1. **Commentaires (priorité produit, pattern Exercism + 360L + GitHub).** Inbox in-app (table d’événements, non-lu, lien semaine). Mentor peut répondre. Mail à l’autre partie seulement, extraît déjà en place, cadence 360L (immédiat ou ≤ 5 min). Ne pas se notifier soi-même.

2. **Arrêter le mail par tâche cochée.** Remplacer par jalons 25/50/75/100 **ou** rien hors digest. Préférence `progressUpdates` = digest, pas firehose.

3. **Digest mercredi (le vrai « mi-parcours »).** Un envoi, deux copies rôle : apprenant (« ta semaine N : X/Y tâches, Z %, dernier commentaire ») et mentor (« [Nom] semaine N : mêmes chiffres + lien »). C’est Thinkific + Together *role-tailored*, pas OpenClassrooms (qui exige une séance). Brancher le flag mort `weeklyReports`. Vendredi peut rester le rappel « encore ouvert » apprenant, ou fusionner.

4. **Ne pas copier OpenClassrooms/BetterUp notes de séance** tant que le produit n’a pas de créneau visio. C’est un autre objet (compte-rendu humain). Un digest automatique n’est pas un substitut de notes SMART.

5. **Canal local (incertitude).** E-mail + inbox web d’abord (comme Thinkific). Push/WhatsApp : Learn, pas V1. Pas de Slack à imiter.

## Confiance

- Haute : cadence 360L, digest Thinkific, chat/push MentorCruise, alerte Exercism, rôle-tailored Together.
- Moyenne : détail OpenClassrooms (snippets), contenu exact Duolingo 2026.
- Basse : BetterUp (login wall).

## Limites

Pas d’essai compte sur ces plateformes. Pas de donnée d’open-rate RM. Pas d’étude WhatsApp/XAF. Marketing Together/Chronus distingué des help centers.

## Validation si on implémente

- Commentaire apprenant → inbox + mail mentor ; réponse mentor → inbox + mail apprenant ; auteur jamais auto-notifié.
- 3 tâches cochées en 10 min → **0 ou 1** mail progression, jamais 3.
- Mercredi 10h Paris : 1 mail apprenant + 1 mail mentor, même % ; entrée inbox des deux.
- Préférences : `commentNotifications` et `weeklyReports` respectées ; désinscription dans le pied.
