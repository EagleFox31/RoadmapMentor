import test from "node:test";
import assert from "node:assert/strict";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
} from "../server/services/invitationTokens";
import { acceptInvitationSchema, createInvitationSchema } from "../shared/schema";

test("tokens are random, url-safe, and stored only as a sha256 hash", () => {
  const a = generateInvitationToken();
  const b = generateInvitationToken();
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, a.token);
  assert.match(a.tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(hashInvitationToken(a.token), a.tokenHash);
  assert.notEqual(a.tokenHash, b.tokenHash);
});

test("expiry defaults to 72 hours and honours INVITATION_TTL_HOURS", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const hours = (env: Record<string, string>) =>
    (invitationExpiry(now, env as NodeJS.ProcessEnv).getTime() - now.getTime()) / 3_600_000;
  assert.equal(hours({}), 72);
  assert.equal(hours({ INVITATION_TTL_HOURS: "24" }), 24);
  for (const bad of ["0", "-5", "abc", "1.5", ""]) {
    assert.equal(hours({ INVITATION_TTL_HOURS: bad }), 72, bad);
  }
});

test("state is derived from status and expiry, with an exclusive boundary", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const pending = (expiresAt: Date) => ({ status: "PENDING" as const, expiresAt });
  assert.equal(invitationState(pending(new Date(now.getTime() + 1)), now), "PENDING");
  assert.equal(invitationState(pending(now), now), "EXPIRED");
  assert.equal(invitationState(pending(new Date(now.getTime() - 1)), now), "EXPIRED");
  assert.equal(invitationState({ status: "ACCEPTED", expiresAt: new Date(0) }, now), "ACCEPTED");
  assert.equal(invitationState({ status: "REVOKED", expiresAt: new Date(0) }, now), "REVOKED");
});

test("invitation schemas cannot carry a role or override the e-mail", () => {
  assert.equal(createInvitationSchema.parse({ email: "  Foo@Bar.COM " }).email, "foo@bar.com");
  assert.throws(() => createInvitationSchema.parse({ email: "x@y.z", role: "MENTOR" }));
  assert.throws(() => createInvitationSchema.parse({ email: "nope" }));
  const ok = { fullName: "Ada", password: "long-enough" };
  assert.deepEqual(acceptInvitationSchema.parse(ok), ok);
  assert.throws(() => acceptInvitationSchema.parse({ ...ok, role: "MENTOR" }));
  assert.throws(() => acceptInvitationSchema.parse({ ...ok, email: "a@b.c" }));
  assert.throws(() => acceptInvitationSchema.parse({ ...ok, password: "short" }));
});
