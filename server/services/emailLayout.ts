// Shared branded layout for transactional e-mails (OTP, invitations, ...).
// Pure functions: no I/O, so every template can be rendered and tested offline.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface BrandedEmailOptions {
  appUrl: string;
  subject: string;
  /** Inbox preview text (plain text, escaped here). */
  preheader: string;
  /** Plain text, escaped here. */
  title: string;
  /** Plain text, escaped here. */
  subtitle: string;
  /** Trusted HTML built by the caller; user values must go through escapeHtml. */
  bodyHtml: string;
  recipient: string;
  /** Plain text shown under the recipient line. */
  footerNote: string;
}

export function renderBrandedEmail(options: BrandedEmailOptions): string {
  const { appUrl } = options;
  return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(options.subject)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01); }
          .badge { display: inline-block; padding: 6px 14px; background: #0f172a; border-radius: 12px; color: #ffffff; font-weight: 700; font-size: 14px; letter-spacing: -0.3px; }
          .badge-accent { color: #34d399; }
          .title { margin: 20px 0 6px 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .subtitle { margin: 0 0 24px 0; font-size: 14px; color: #64748b; }
          .greeting { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 12px 0; }
          .message { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px 0; }
          .code-card { background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #a7f3d0; border-radius: 16px; padding: 24px 16px; text-align: center; margin: 28px 0; }
          .code-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 10px; }
          .code-digits { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #047857; line-height: 1.2; padding-left: 12px; }
          .code-validity { margin-top: 12px; font-size: 12px; font-weight: 600; color: #065f46; display: inline-block; padding: 4px 10px; background: rgba(5,150,105,0.1); border-radius: 8px; }
          .highlight-title { font-size: 17px; font-weight: 800; color: #047857; line-height: 1.4; }
          .security-box { background-color: #f8fafc; border-left: 3px solid #059669; padding: 12px 16px; border-radius: 0 10px 10px 0; margin: 24px 0; font-size: 13px; color: #475569; line-height: 1.5; }
          .fallback-link { font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; margin: 0 0 8px 0; }
          .fallback-link a { color: #059669; }
          .signature { margin: 28px 0 0 0; font-size: 14px; color: #334155; line-height: 1.6; }
          .signature-team { font-weight: 700; color: #0f172a; margin-top: 4px; }
          .footer-divider { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 20px 0; }
          .footer-links { text-align: center; font-size: 12px; margin-bottom: 12px; }
          .footer-links a { color: #059669; text-decoration: none; font-weight: 600; margin: 0 8px; }
          .footer-links a:hover { text-decoration: underline; }
          .footer-text { text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 10px 0; }
          .footer-copy { text-align: center; font-size: 11px; color: #cbd5e1; margin: 0; }
        </style>
      </head>
      <body>
        <!-- Pré-en-tête masqué pour l'aperçu boîte de réception -->
        <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
          ${escapeHtml(options.preheader)}
        </div>

        <div class="container">
          <div style="text-align: center; margin-bottom: 20px;">
            <div class="badge">
              Roadmap <span class="badge-accent">Mentor</span>
            </div>
            <h1 class="title">${escapeHtml(options.title)}</h1>
            <p class="subtitle">${escapeHtml(options.subtitle)}</p>
          </div>

          ${options.bodyHtml}

          <div class="signature">
            À très vite sur votre feuille de route,
            <div class="signature-team">L'équipe Roadmap Mentor</div>
          </div>

          <hr class="footer-divider" />

          <div class="footer-links">
            <a href="${appUrl}">Accéder à la plateforme</a> •
            <a href="${appUrl}/roadmap">Feuilles de route</a> •
            <a href="mailto:support@trigenys.com">Support & Aide</a>
          </div>

          <p class="footer-text">
            Cet e-mail a été envoyé automatiquement à <span style="color: #64748b; font-weight: 500;">${escapeHtml(options.recipient)}</span>.<br />
            ${escapeHtml(options.footerNote)}
          </p>

          <p class="footer-copy">
            © ${new Date().getFullYear()} Roadmap Mentor by Trigenys. Tous droits réservés.
          </p>
        </div>
      </body>
      </html>
    `;
}

/** Call-to-action button with inline styles (survives clients that strip <style>). */
export function renderButton(href: string, label: string): string {
  return `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${escapeHtml(href)}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px;">${escapeHtml(label)}</a>
          </div>`;
}
