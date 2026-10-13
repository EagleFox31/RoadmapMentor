import test from "node:test";
import assert from "node:assert/strict";
import type { EmailOtp } from "../shared/schema";
import type { EmailOtpStore } from "../server/data/emailOtps";
import { OtpService } from "../server/services/otpService";
import { canLogOtpCodes, isDirectRegistrationEnabled } from "../server/security";

/** In-memory EmailOtpStore mirroring the repository queries. */
class MemoryOtpStore implements EmailOtpStore {
  rows: EmailOtp[] = [];

  async createEmailOtp(data: Parameters<EmailOtpStore["createEmailOtp"]>[0]): Promise<EmailOtp> {
    const row = {
      id: this.rows.length + 1,
      email: data.email.toLowerCase().trim(),
      codeHash: data.codeHash,
      purpose: data.purpose,
      payload: data.payload ?? null,
      attempts: 0,
      expiresAt: data.expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    } as EmailOtp;
    this.rows.push(row);
    return row;
  }

  async getLatestActiveEmailOtp(email: string, purpose: "REGISTRATION" | "LOGIN") {
    const now = Date.now();
    return this.rows
      .filter((r) => r.email === email.toLowerCase().trim() && r.purpose === purpose && !r.consumedAt && r.expiresAt.getTime() >= now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async getLatestOtp(email: string) {
    return this.rows
      .filter((r) => r.email === email.toLowerCase().trim())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async countRecentOtps(email: string, since: Date) {
    return this.rows.filter((r) => r.email === email.toLowerCase().trim() && r.createdAt >= since).length;
  }

  async incrementOtpAttempts(id: number) {
    const row = this.rows.find((r) => r.id === id)!;
    row.attempts += 1;
    return row.attempts;
  }

  async markOtpConsumed(id: number) {
    this.rows.find((r) => r.id === id)!.consumedAt = new Date();
  }

  /** Moves every OTP back in time, as if `seconds` had elapsed. */
  age(seconds: number) {
    for (const r of this.rows) r.createdAt = new Date(r.createdAt.getTime() - seconds * 1000);
  }
}

function setup(delivered = true) {
  const store = new MemoryOtpStore();
  const sent: string[] = [];
  const mailer = {
    sendOtp: async (_to: string, code: string) => {
      sent.push(code);
      return delivered;
    },
  };
  return { store, sent, service: new OtpService(mailer, store) };
}

const EMAIL = "ada@example.com";

test("a delivered code verifies once, then is consumed", async () => {
  const { service, sent } = setup();
  assert.equal((await service.sendOtp(EMAIL, "LOGIN")).success, true);
  assert.deepEqual(await service.verifyOtp(EMAIL, sent[0], "LOGIN"), { valid: true, payload: undefined });
  assert.equal((await service.verifyOtp(EMAIL, sent[0], "LOGIN")).valid, false);
});

test("a code is bound to its purpose", async () => {
  const { service, sent } = setup();
  await service.sendOtp(EMAIL, "REGISTRATION", "{}");
  assert.equal((await service.verifyOtp(EMAIL, sent[0], "LOGIN")).valid, false);
});

test("five wrong attempts invalidate even the correct code", async () => {
  const { service, sent } = setup();
  await service.sendOtp(EMAIL, "LOGIN");
  const wrong = sent[0] === "000000" ? "111111" : "000000";
  for (let i = 1; i <= 5; i++) {
    const res = await service.verifyOtp(EMAIL, wrong, "LOGIN");
    assert.equal(res.valid, false);
    if (i === 5) assert.match(res.error!, /invalidé/);
  }
  const final = await service.verifyOtp(EMAIL, sent[0], "LOGIN");
  assert.equal(final.valid, false);
  assert.match(final.error!, /Trop de tentatives/);
});

test("a new code is refused during the 60s cooldown", async () => {
  const { service, store } = setup();
  await service.sendOtp(EMAIL, "LOGIN");
  const res = await service.sendOtp(EMAIL, "LOGIN");
  assert.equal(res.success, false);
  assert.equal(res.failure, "RATE_LIMITED");
  assert.equal(store.rows.length, 1, "nothing is written while rate limited");
});

test("at most 3 codes per hour and 5 per day", async () => {
  const { service, store } = setup();
  for (let i = 0; i < 3; i++) {
    assert.equal((await service.sendOtp(EMAIL, "LOGIN")).success, true);
    store.age(61);
  }
  assert.equal((await service.sendOtp(EMAIL, "LOGIN")).failure, "RATE_LIMITED");

  store.age(3600);
  for (let i = 0; i < 2; i++) {
    assert.equal((await service.sendOtp(EMAIL, "LOGIN")).success, true);
    store.age(61);
  }
  store.age(3600);
  const capped = await service.sendOtp(EMAIL, "LOGIN");
  assert.equal(capped.failure, "RATE_LIMITED");
  assert.match(capped.message!, /aujourd'hui/);
});

test("a delivery failure is reported as such", async () => {
  const { service } = setup(false);
  const res = await service.sendOtp(EMAIL, "LOGIN");
  assert.equal(res.success, false);
  assert.equal(res.failure, "DELIVERY_FAILED");
});

test("direct registration and OTP code logging are off by default outside development", () => {
  assert.equal(isDirectRegistrationEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isDirectRegistrationEnabled({}), false);
  assert.equal(isDirectRegistrationEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isDirectRegistrationEnabled({ NODE_ENV: "production", AUTH_DIRECT_REGISTRATION: "true" }), true);
  assert.equal(isDirectRegistrationEnabled({ NODE_ENV: "development", AUTH_DIRECT_REGISTRATION: "false" }), false);

  assert.equal(canLogOtpCodes({ NODE_ENV: "production" }), false);
  assert.equal(canLogOtpCodes({ NODE_ENV: "production", OTP_LOG_CODES: "" }), false);
  assert.equal(canLogOtpCodes({ NODE_ENV: "development" }), true);
  assert.equal(canLogOtpCodes({ NODE_ENV: "production", OTP_LOG_CODES: "TRUE" }), true);
});
