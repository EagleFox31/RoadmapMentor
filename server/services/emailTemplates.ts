import {
  escapeHtml,
  renderBrandedEmail,
  renderButton,
  renderHighlightCard,
  renderProgressBar,
} from "./emailLayout";

const APP_NAME = "Roadmap Mentor";
const PREF_NOTE = "Vous pouvez désactiver ce type d'alerte depuis Préférences.";

function hello(name: string): string {
  return `Bonjour <strong>${escapeHtml(name)}</strong>,`;
}

function actionBlock(appUrl: string, label: string): string {
  return `${renderButton(appUrl, label)}
          <p class="fallback-link">Le bouton ne fonctionne pas ? Ouvrez <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>`;
}

function notifyEmail(
  input: {
    appUrl: string;
    to: string;
    subject: string;
    preheader: string;
    title: string;
    subtitle: string;
    bodyHtml: string;
  },
): RenderedEmail {
  return {
    subject: input.subject,
    html: renderBrandedEmail({
      appUrl: input.appUrl,
      subject: input.subject,
      preheader: input.preheader,
      title: input.title,
      subtitle: input.subtitle,
      recipient: input.to,
      footerNote: PREF_NOTE,
      bodyHtml: input.bodyHtml,
    }),
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function buildOtpEmail(input: {
  appUrl: string;
  to: string;
  code: string;
  purpose: "REGISTRATION" | "LOGIN";
  userName?: string;
}): RenderedEmail {
  const isReg = input.purpose === "REGISTRATION";
  const subject = isReg
    ? `${APP_NAME} — Votre code de confirmation : ${input.code}`
    : `${APP_NAME} — Votre code de connexion : ${input.code}`;
  const greeting = input.userName
    ? `Bonjour <strong>${escapeHtml(input.userName)}</strong> 👋,`
    : "Bonjour 👋,";
  const message = isReg
    ? "Merci de rejoindre <strong>Roadmap Mentor</strong> ! Pour finaliser la création de votre compte apprenant et vérifier votre adresse e-mail, voici votre code de confirmation :"
    : "Vous avez demandé à vous connecter à votre compte <strong>Roadmap Mentor</strong> sans mot de passe. Voici votre code d'accès temporaire :";

  const html = renderBrandedEmail({
    appUrl: input.appUrl,
    subject,
    preheader: isReg
      ? `Votre code de confirmation est ${input.code}. Validez votre inscription pour accéder à votre roadmap.`
      : `Votre code de connexion est ${input.code}. Accédez directement à votre espace Roadmap Mentor.`,
    title: isReg ? "Bienvenue sur Roadmap Mentor !" : "Connexion sécurisée",
    subtitle: isReg ? "Validation de votre compte apprenant" : "Code d'accès temporaire sécurisé",
    recipient: input.to,
    footerNote: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.",
    bodyHtml: `
          <p class="greeting">${greeting}</p>
          <p class="message">${message}</p>

          <div class="code-card">
            <div class="code-label">Votre code de sécurité</div>
            <div class="code-digits">${escapeHtml(input.code)}</div>
            <div class="code-validity">⏱️ Valable 10 minutes • À usage unique</div>
          </div>

          <div class="security-box">
            🔒 <strong>Conseil de sécurité :</strong> Ne transmettez jamais ce code à un tiers. L'équipe Roadmap Mentor ne vous le demandera jamais par message ou par téléphone.
          </div>`,
  });
  return { subject, html };
}

export function buildInvitationEmail(input: {
  appUrl: string;
  to: string;
  mentorName: string;
  roadmapTitle: string;
  token: string;
  expiresAt: Date;
}): RenderedEmail {
  const inviteUrl = `${input.appUrl}/invite/${encodeURIComponent(input.token)}`;
  const expiry = input.expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const mentor = escapeHtml(input.mentorName);
  const subject = `${APP_NAME} — ${input.mentorName} vous invite à rejoindre sa roadmap`;

  const html = renderBrandedEmail({
    appUrl: input.appUrl,
    subject,
    preheader: `${input.mentorName} vous invite à suivre la roadmap « ${input.roadmapTitle} ». Créez votre compte pour commencer.`,
    title: "Vous êtes invité·e !",
    subtitle: "Invitation à un parcours de mentorat",
    recipient: input.to,
    footerNote: "Si vous ne connaissez pas ce mentor, vous pouvez ignorer cet e-mail : aucun compte ne sera créé.",
    bodyHtml: `
          <p class="greeting">Bonjour 👋,</p>
          <p class="message"><strong>${mentor}</strong> vous invite à rejoindre son parcours de mentorat sur <strong>Roadmap Mentor</strong> :</p>

          <div class="code-card">
            <div class="code-label">Votre feuille de route</div>
            <div class="highlight-title">${escapeHtml(input.roadmapTitle)}</div>
            <div class="code-validity">⏱️ Invitation valable jusqu'au ${escapeHtml(expiry)}</div>
          </div>

          <p class="message">Créez votre compte pour accéder à vos semaines, ressources et livrables, et suivre votre progression avec ${mentor}.</p>
${renderButton(inviteUrl, "Créer mon compte")}
          <p class="fallback-link">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br /><a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>

          <div class="security-box">
            🔒 <strong>Lien personnel :</strong> à usage unique, ne le transférez pas. Il expire le ${escapeHtml(expiry)}.
          </div>`,
  });
  return { subject, html };
}

export function buildTaskReminderEmail(input: {
  appUrl: string;
  to: string;
  userName: string;
  weekNumber: number;
  pendingTasksCount: number;
}): RenderedEmail {
  const tasks = `${input.pendingTasksCount} tâche${input.pendingTasksCount > 1 ? "s" : ""}`;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Rappel : semaine ${input.weekNumber}`,
    preheader: `${tasks} encore ouvertes pour la semaine ${input.weekNumber}.`,
    title: "Un petit rappel",
    subtitle: `Semaine ${input.weekNumber} · tâches encore ouvertes`,
    bodyHtml: `
          <p class="greeting">${hello(input.userName)}</p>
          <p class="message">Il vous reste du chemin sur la semaine ${input.weekNumber}.</p>
${renderHighlightCard("À terminer", escapeHtml(tasks), `Semaine ${input.weekNumber}`)}
          <p class="message">Reprenez là où vous vous êtes arrêté : une tâche faite aujourd’hui garde le rythme.</p>
${actionBlock(input.appUrl, "Voir mes tâches")}`,
  });
}

export function buildWeekPreparationEmail(input: {
  appUrl: string;
  to: string;
  userName: string;
  nextWeekNumber: number;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Préparez la semaine ${input.nextWeekNumber}`,
    preheader: `C’est le moment de préparer la semaine ${input.nextWeekNumber} pour vos apprenants.`,
    title: "Préparer la suite",
    subtitle: `Semaine ${input.nextWeekNumber} · objectifs, tâches, ressources`,
    bodyHtml: `
          <p class="greeting">${hello(input.userName)}</p>
          <p class="message">Vos apprenants auront besoin de la semaine suivante. Préparez objectifs, tâches, ressources et livrables maintenant, pour qu’ils démarrent sans attendre.</p>
${renderHighlightCard("À préparer", `Semaine ${input.nextWeekNumber}`)}
${actionBlock(input.appUrl, "Préparer la semaine")}`,
  });
}

export function buildProgressUpdateEmail(input: {
  appUrl: string;
  to: string;
  mentorName: string;
  learnerName: string;
  weekNumber: number;
  completionPercentage: number;
}): RenderedEmail {
  const pct = Math.max(0, Math.min(100, Math.round(input.completionPercentage)));
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — ${input.learnerName} a progressé (${pct} %)`,
    preheader: `${input.learnerName} est à ${pct} % de la semaine ${input.weekNumber}.`,
    title: "Progression d’un apprenant",
    subtitle: `Semaine ${input.weekNumber}`,
    bodyHtml: `
          <p class="greeting">${hello(input.mentorName)}</p>
          <p class="message"><strong>${escapeHtml(input.learnerName)}</strong> a avancé sur la semaine ${input.weekNumber}.</p>
${renderHighlightCard("Complété", `${pct} %`, `Semaine ${input.weekNumber}`)}
${renderProgressBar(pct)}
${actionBlock(input.appUrl, "Voir la progression")}`,
  });
}

export function buildCommentNotificationEmail(input: {
  appUrl: string;
  to: string;
  recipientName: string;
  commenterName: string;
  weekNumber: number;
  commentPreview: string;
}): RenderedEmail {
  const preview = input.commentPreview.length > 200
    ? `${input.commentPreview.slice(0, 200)}…`
    : input.commentPreview;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Nouveau commentaire de ${input.commenterName}`,
    preheader: `${input.commenterName} a commenté la semaine ${input.weekNumber}.`,
    title: "Nouveau commentaire",
    subtitle: `Semaine ${input.weekNumber}`,
    bodyHtml: `
          <p class="greeting">${hello(input.recipientName)}</p>
          <p class="message"><strong>${escapeHtml(input.commenterName)}</strong> a laissé un commentaire sur la semaine ${input.weekNumber} :</p>
${renderHighlightCard("Message", escapeHtml(preview))}
${actionBlock(input.appUrl, "Voir le commentaire")}`,
  });
}

export function buildAIGenerationSuccessEmail(input: {
  appUrl: string;
  to: string;
  userName: string;
  weeksGenerated: number;
}): RenderedEmail {
  const weeks = `${input.weeksGenerated} semaine${input.weeksGenerated > 1 ? "s" : ""}`;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Roadmap générée`,
    preheader: `Votre roadmap de ${weeks} est prête.`,
    title: "Roadmap générée",
    subtitle: "Génération automatique terminée",
    bodyHtml: `
          <p class="greeting">${hello(input.userName)}</p>
          <p class="message">Votre feuille de route est prête. Objectifs, tâches et ressources ont été créés.</p>
${renderHighlightCard("Semaines créées", escapeHtml(weeks))}
${actionBlock(input.appUrl, "Voir ma roadmap")}`,
  });
}

export function buildAIGenerationFailureEmail(input: {
  appUrl: string;
  to: string;
  userName: string;
  errorMessage: string;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — La génération de roadmap a échoué`,
    preheader: "La génération automatique n’a pas abouti. Vous pouvez réessayer.",
    title: "Génération interrompue",
    subtitle: "La roadmap n’a pas pu être créée",
    bodyHtml: `
          <p class="greeting">${hello(input.userName)}</p>
          <p class="message">Nous n’avons pas pu générer la roadmap cette fois-ci.</p>
          <div class="security-box"><strong>Détail :</strong> ${escapeHtml(input.errorMessage)}</div>
          <p class="message">Réessayez dans quelques instants. Si ça bloque encore, écrivez à support@trigenys.com.</p>
${actionBlock(input.appUrl, "Réessayer")}`,
  });
}

export function buildWeekValidationEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  weekNumber: number;
  mentorName: string;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Semaine ${input.weekNumber} validée`,
    preheader: `${input.mentorName} a validé la semaine ${input.weekNumber}. Elle est maintenant visible.`,
    title: "Semaine ouverte",
    subtitle: `Semaine ${input.weekNumber} · validée par votre mentor`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message"><strong>${escapeHtml(input.mentorName)}</strong> a validé la semaine ${input.weekNumber}. Vous pouvez y travailler maintenant.</p>
${renderHighlightCard("Nouvelle semaine", `Semaine ${input.weekNumber}`, "Visible sur votre feuille de route")}
${actionBlock(input.appUrl, "Ouvrir la semaine")}`,
  });
}

export function buildNewTaskAssignedEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  weekNumber: number;
  newTasksCount: number;
}): RenderedEmail {
  const tasks = `${input.newTasksCount} nouvelle${input.newTasksCount > 1 ? "s" : ""} tâche${input.newTasksCount > 1 ? "s" : ""}`;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — ${tasks} · semaine ${input.weekNumber}`,
    preheader: `Votre mentor a ajouté ${tasks} à la semaine ${input.weekNumber}.`,
    title: "Nouvelles tâches",
    subtitle: `Semaine ${input.weekNumber}`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">Votre mentor vient d’ajouter du travail sur la semaine ${input.weekNumber}.</p>
${renderHighlightCard("Ajout", escapeHtml(tasks), `Semaine ${input.weekNumber}`)}
${actionBlock(input.appUrl, "Voir les tâches")}`,
  });
}

export function buildScreenshotUploadedEmail(input: {
  appUrl: string;
  to: string;
  mentorName: string;
  learnerName: string;
  taskTitle: string;
  weekNumber: number;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — ${input.learnerName} a déposé une capture`,
    preheader: `${input.learnerName} a envoyé une capture pour « ${input.taskTitle} » (semaine ${input.weekNumber}).`,
    title: "Capture reçue",
    subtitle: `Semaine ${input.weekNumber}`,
    bodyHtml: `
          <p class="greeting">${hello(input.mentorName)}</p>
          <p class="message"><strong>${escapeHtml(input.learnerName)}</strong> a déposé une capture d’écran.</p>
${renderHighlightCard("Tâche", escapeHtml(input.taskTitle), `Semaine ${input.weekNumber}`)}
          <p class="message">Ouvrez la soumission pour relire le travail.</p>
${actionBlock(input.appUrl, "Voir la capture")}`,
  });
}

export function buildWeekModifiedEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  weekNumber: number;
  modificationType: string;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Semaine ${input.weekNumber} mise à jour`,
    preheader: `Votre mentor a modifié la semaine ${input.weekNumber} (${input.modificationType}).`,
    title: "Semaine mise à jour",
    subtitle: `Semaine ${input.weekNumber} · ${input.modificationType}`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">Votre mentor a modifié la semaine ${input.weekNumber}.</p>
${renderHighlightCard("Modification", escapeHtml(input.modificationType), `Semaine ${input.weekNumber}`)}
          <p class="message">Relisez la semaine pour ajuster votre planning.</p>
${actionBlock(input.appUrl, "Voir les changements")}`,
  });
}

export function buildDeadlineApproachingEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  weekNumber: number;
  daysRemaining: number;
  pendingTasksCount: number;
}): RenderedEmail {
  const days = `${input.daysRemaining} jour${input.daysRemaining > 1 ? "s" : ""}`;
  const tasks = `${input.pendingTasksCount} tâche${input.pendingTasksCount > 1 ? "s" : ""}`;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Plus que ${days} pour la semaine ${input.weekNumber}`,
    preheader: `${days} restants, ${tasks} encore ouvertes.`,
    title: "Échéance proche",
    subtitle: `Semaine ${input.weekNumber} · ${days} restants`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">La semaine ${input.weekNumber} se termine bientôt.</p>
${renderHighlightCard("Reste", escapeHtml(days), `${tasks} encore ouvertes`)}
          <p class="message">Terminez ce qui est ouvert pour rester dans les temps.</p>
${actionBlock(input.appUrl, "Terminer mes tâches")}`,
  });
}

export function buildStreakWarningEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  currentStreak: number;
}): RenderedEmail {
  const days = `${input.currentStreak} jour${input.currentStreak > 1 ? "s" : ""}`;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Votre série de ${days} est en pause`,
    preheader: `Pas encore d’activité aujourd’hui. Votre série : ${days}.`,
    title: "Série en pause",
    subtitle: `${days} d’affilée jusqu’ici`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">Vous n’avez pas encore avancé aujourd’hui.</p>
${renderHighlightCard("Série en cours", escapeHtml(days))}
          <p class="message">Une seule tâche suffit pour la garder.</p>
${actionBlock(input.appUrl, "Continuer aujourd’hui")}`,
  });
}

export function buildMilestoneReachedEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  milestonePercentage: number;
}): RenderedEmail {
  const pct = Math.max(0, Math.min(100, Math.round(input.milestonePercentage)));
  const done = pct === 100;
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — ${pct} % de votre roadmap`,
    preheader: done
      ? "Vous avez terminé votre feuille de route."
      : `Vous avez franchi ${pct} % de votre feuille de route.`,
    title: done ? "Parcours terminé" : "Jalon atteint",
    subtitle: `${pct} % de la roadmap`,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">${done
            ? "Vous avez terminé votre feuille de route. Beau travail."
            : `Vous venez de passer le cap des ${pct} %.`}</p>
${renderHighlightCard("Avancement", `${pct} %`)}
${renderProgressBar(pct)}
${actionBlock(input.appUrl, "Voir ma progression")}`,
  });
}

export function buildBadgeUnlockedEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  badgeName: string;
  badgeDescription: string;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Badge : ${input.badgeName}`,
    preheader: `Nouveau badge : ${input.badgeName}.`,
    title: "Nouveau badge",
    subtitle: input.badgeName,
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">Vous venez de débloquer un badge.</p>
${renderHighlightCard(input.badgeName, escapeHtml(input.badgeDescription))}
${actionBlock(input.appUrl, "Voir mes badges")}`,
  });
}

export function buildWeeklyReportEmail(input: {
  appUrl: string;
  to: string;
  learnerName: string;
  tasksCompleted: number;
  hoursSpent: number;
  weeksCompleted: number;
  streak: number;
}): RenderedEmail {
  return notifyEmail({
    appUrl: input.appUrl,
    to: input.to,
    subject: `${APP_NAME} — Votre rapport de la semaine`,
    preheader: `${input.tasksCompleted} tâches, ${input.weeksCompleted} semaines terminées.`,
    title: "Rapport de la semaine",
    subtitle: "Ce que vous avez avancé",
    bodyHtml: `
          <p class="greeting">${hello(input.learnerName)}</p>
          <p class="message">Voici le résumé de votre semaine.</p>
${renderHighlightCard("Tâches terminées", String(input.tasksCompleted), `${input.weeksCompleted} semaine${input.weeksCompleted > 1 ? "s" : ""} close${input.weeksCompleted > 1 ? "s" : ""} · ${input.streak} jour${input.streak > 1 ? "s" : ""} de série · ${input.hoursSpent} h`)}
${actionBlock(input.appUrl, "Voir ma roadmap")}`,
  });
}
