import nodemailer from "nodemailer";

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface MailTransport {
  readonly provider: "resend" | "smtp" | "none";
  send(message: MailMessage): Promise<{ id: string }>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Resend passe par HTTPS (443) : utile là où les ports SMTP sont bloqués (Render).
 * Une clé d'API suffit ; MAIL_PROVIDER=smtp force l'ancien chemin.
 */
export function createResendTransport(apiKey: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): MailTransport {
  return {
    provider: "resend",
    async send(message) {
      const response = await fetchImpl(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Le message d'erreur du fournisseur ne contient jamais la clé.
        throw new Error(`Resend ${response.status}: ${payload?.message ?? "request failed"}`);
      }
      return { id: String(payload?.id ?? "") };
    },
  };
}

function createSmtpTransport(env: NodeJS.ProcessEnv): MailTransport {
  const port = parseInt(env.MAIL_PORT || "465");
  const transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port,
    secure: port === 465, // 465 : SSL/TLS ; 587 : STARTTLS
    auth: { user: env.MAIL_USER, pass: env.MAIL_PASS },
  });
  return {
    provider: "smtp",
    async send(message) {
      const info = await transporter.sendMail(message);
      return { id: String(info.messageId ?? "") };
    },
  };
}

/** Choix du fournisseur : MAIL_PROVIDER explicite, sinon Resend si RESEND_API_KEY, sinon SMTP si MAIL_HOST. */
export function createMailTransport(env: NodeJS.ProcessEnv = process.env, fetchImpl?: FetchLike): MailTransport {
  const requested = env.MAIL_PROVIDER?.toLowerCase();
  if (requested === "resend" || (!requested && env.RESEND_API_KEY)) {
    if (!env.RESEND_API_KEY) throw new Error("MAIL_PROVIDER=resend requires RESEND_API_KEY");
    return createResendTransport(env.RESEND_API_KEY, fetchImpl);
  }
  if (requested === "smtp" || env.MAIL_HOST) {
    return createSmtpTransport(env);
  }
  return {
    provider: "none",
    async send() {
      throw new Error("No mail provider configured (set RESEND_API_KEY or MAIL_HOST)");
    },
  };
}
