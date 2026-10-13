import crypto from "node:crypto";
import type { EmailOtpStore } from "../data/emailOtps";

export interface OtpCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export class OtpService {
  private emailService?: { sendOtp: (to: string, code: string, purpose: "REGISTRATION" | "LOGIN", userName?: string) => Promise<boolean> };
  private store?: EmailOtpStore;

  constructor(
    emailService?: { sendOtp: (to: string, code: string, purpose: "REGISTRATION" | "LOGIN", userName?: string) => Promise<boolean> },
    store?: EmailOtpStore,
  ) {
    this.emailService = emailService;
    this.store = store;
  }

  private async getEmailService() {
    if (this.emailService) return this.emailService;
    const { EmailService } = await import("./emailService");
    this.emailService = new EmailService();
    return this.emailService;
  }

  private async getStore(): Promise<EmailOtpStore> {
    if (this.store) return this.store;
    const { storage } = await import("../storage");
    this.store = storage;
    return this.store;
  }

  generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  hashCode(code: string): string {
    return crypto.createHash("sha256").update(code.trim()).digest("hex");
  }

  async checkRateLimits(email: string): Promise<OtpCheckResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();
    const store = await this.getStore();

    // 1. Cooldown de 60 secondes depuis le dernier OTP émis
    const latest = await store.getLatestOtp(normalizedEmail);
    if (latest) {
      const elapsedSeconds = Math.floor((now.getTime() - new Date(latest.createdAt).getTime()) / 1000);
      if (elapsedSeconds < 60) {
        return {
          allowed: false,
          reason: `Veuillez patienter ${60 - elapsedSeconds}s avant de demander un nouveau code.`,
          retryAfterSeconds: 60 - elapsedSeconds,
        };
      }
    }

    // 2. Plafond horaire : max 3 OTPs par heure
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyCount = await store.countRecentOtps(normalizedEmail, oneHourAgo);
    if (hourlyCount >= 3) {
      return {
        allowed: false,
        reason: "Nombre maximal de codes atteint pour cette heure (3 max). Veuillez patienter ou utiliser votre mot de passe.",
      };
    }

    // 3. Plafond journalier : max 5 OTPs par 24 heures
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dailyCount = await store.countRecentOtps(normalizedEmail, oneDayAgo);
    if (dailyCount >= 5) {
      return {
        allowed: false,
        reason: "Nombre maximal de codes atteint pour aujourd'hui (5 max). Veuillez utiliser votre mot de passe pour vous connecter.",
      };
    }

    return { allowed: true };
  }

  async sendOtp(
    email: string,
    purpose: "REGISTRATION" | "LOGIN",
    payload?: string,
    userName?: string,
  ): Promise<{ success: boolean; message?: string; failure?: "RATE_LIMITED" | "DELIVERY_FAILED" }> {
    const check = await this.checkRateLimits(email);
    if (!check.allowed) {
      return { success: false, message: check.reason, failure: "RATE_LIMITED" };
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const store = await this.getStore();

    await store.createEmailOtp({
      email,
      codeHash,
      purpose,
      payload,
      expiresAt,
    });

    const emailService = await this.getEmailService();
    const sent = await emailService.sendOtp(email, code, purpose, userName);
    if (!sent) {
      return {
        success: false,
        message: "Échec de l'envoi de l'e-mail. Veuillez vérifier votre adresse et réessayer.",
        failure: "DELIVERY_FAILED",
      };
    }

    return {
      success: true,
      message: "Un code de validation à 6 chiffres vous a été envoyé par e-mail.",
    };
  }

  async verifyOtp(
    email: string,
    code: string,
    purpose: "REGISTRATION" | "LOGIN",
  ): Promise<{ valid: boolean; error?: string; payload?: string }> {
    const store = await this.getStore();
    const activeOtp = await store.getLatestActiveEmailOtp(email, purpose);

    if (!activeOtp) {
      return {
        valid: false,
        error: "Code expiré ou introuvable. Veuillez demander un nouveau code.",
      };
    }

    if (activeOtp.attempts >= 5) {
      await store.markOtpConsumed(activeOtp.id);
      return {
        valid: false,
        error: "Trop de tentatives erronées. Ce code a été invalidé pour votre sécurité.",
      };
    }

    const expectedHash = this.hashCode(code);
    if (activeOtp.codeHash !== expectedHash) {
      const attempts = await store.incrementOtpAttempts(activeOtp.id);
      const remaining = 5 - attempts;
      return {
        valid: false,
        error: remaining > 0
          ? `Code incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? "s" : ""}.`
          : "Code incorrect. Ce code est désormais invalidé, demandez-en un nouveau.",
      };
    }

    // Code valide : on le marque consommé
    await store.markOtpConsumed(activeOtp.id);
    return {
      valid: true,
      payload: activeOtp.payload || undefined,
    };
  }
}

export const otpService = new OtpService();
