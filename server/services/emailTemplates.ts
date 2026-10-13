import { escapeHtml, renderBrandedEmail, renderButton } from "./emailLayout";

const APP_NAME = "Roadmap Mentor";

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
