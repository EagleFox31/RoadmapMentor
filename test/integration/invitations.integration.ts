import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  api,
  BASE,
  ensureMentor,
  expectAccess,
  forgeInvitationToken,
  register,
  run,
  type Actor,
} from "./support/api";

describe("learner invitation by e-mail", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: Actor;
  let otherMentor: Actor;
  let learner: Actor;
  let roadmapId: number;

  const invite = (email: string, token = mentor.token, id = roadmapId) =>
    api("POST", `/api/roadmaps/${id}/invitations`, token, { email });
  const newEmail = (label: string) => `inv.${label}.${run}@it.test`;
  const accept = (token: string, body: unknown) =>
    api("POST", `/api/invitations/token/${token}/accept`, undefined, body);

  before(async () => {
    mentor = await ensureMentor("inviter");
    otherMentor = await ensureMentor("inviter-other");
    learner = await register("inv-existing");
    const roadmap = await api("POST", "/api/roadmaps", mentor.token, { title: `Invitations ${run}` });
    assert.equal(roadmap.status, 201);
    roadmapId = roadmap.data.id;
  });

  test("inviting an unknown e-mail creates a pending invitation without leaking the token", async () => {
    const r = await invite(newEmail("create"));
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.outcome, "invited");
    assert.equal(typeof r.data.emailSent, "boolean");
    const serialized = JSON.stringify(r.data).toLowerCase();
    assert.ok(!serialized.includes("tokenhash") && !serialized.includes("token_hash"));
    assert.ok(!("token" in r.data.invitation));

    const list = await api("GET", `/api/roadmaps/${roadmapId}/invitations`, mentor.token);
    assert.equal(list.status, 200);
    const row = list.data.find((entry: any) => entry.id === r.data.invitation.id);
    assert.equal(row.state, "PENDING");
    assert.ok(!("tokenHash" in row));
  });

  test("inviting the same e-mail again is idempotent", async () => {
    const email = newEmail("idem");
    const first = await invite(email);
    const second = await invite(email);
    assert.equal(second.status, 201);
    assert.equal(second.data.invitation.id, first.data.invitation.id);
    assert.equal(second.data.invitation.sendCount, 2);
  });

  test("an existing learner is attached directly, an existing mentor is refused", async () => {
    const attached = await invite(learner.email);
    assert.equal(attached.status, 201, JSON.stringify(attached.data));
    assert.equal(attached.data.outcome, "attached");
    const again = await invite(learner.email);
    assert.equal(again.status, 200);
    assert.equal(again.data.outcome, "attached");

    const refused = await invite(otherMentor.email);
    assert.equal(refused.status, 409);
  });

  test("invalid e-mail is a validation error", async () => {
    const r = await invite("not-an-email");
    assert.equal(r.status, 400);
  });

  test("acceptance creates a LEARNER attached to the roadmap and consumes the token", async () => {
    const email = newEmail("accept");
    const created = await invite(email);
    const token = forgeInvitationToken(created.data.invitation.id);

    const info = await api("GET", `/api/invitations/token/${token}`);
    assert.equal(info.status, 200, JSON.stringify(info.data));
    assert.equal(info.data.email, email);
    assert.equal(info.data.roadmapId, roadmapId);

    const accepted = await accept(token, { fullName: "Invited Learner", password: "Invited-pass-1" });
    assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
    assert.equal(accepted.data.user.role, "LEARNER");
    assert.equal(accepted.data.user.email, email);
    assert.ok(!("password" in accepted.data.user));

    const roadmaps = await api("GET", "/api/roadmaps", accepted.data.token);
    assert.equal(roadmaps.status, 200);
    assert.ok(roadmaps.data.some((roadmap: any) => roadmap.id === roadmapId));

    const reuse = await accept(token, { fullName: "Again", password: "Invited-pass-1" });
    assert.equal(reuse.status, 410);
    assert.equal(reuse.data.reason, "USED");
    assert.equal((await api("GET", `/api/invitations/token/${token}`)).status, 410);
  });

  test("acceptance can never choose a role or another e-mail", async () => {
    const created = await invite(newEmail("strict"));
    const token = forgeInvitationToken(created.data.invitation.id);
    for (const extra of [{ role: "MENTOR" }, { email: "someone.else@it.test" }]) {
      const r = await accept(token, { fullName: "X", password: "Invited-pass-1", ...extra });
      assert.equal(r.status, 400, JSON.stringify(r.data));
    }
    assert.equal((await api("GET", `/api/invitations/token/${token}`)).status, 200);
  });

  test("unknown token is a 404", async () => {
    assert.equal((await api("GET", "/api/invitations/token/does-not-exist")).status, 404);
    assert.equal((await accept("does-not-exist", { fullName: "X", password: "Invited-pass-1" })).status, 404);
  });

  test("a revoked invitation cannot be accepted", async () => {
    const created = await invite(newEmail("revoke"));
    const id = created.data.invitation.id;
    const token = forgeInvitationToken(id);
    assert.equal((await api("DELETE", `/api/invitations/${id}`, mentor.token)).status, 200);
    assert.equal((await api("DELETE", `/api/invitations/${id}`, mentor.token)).status, 200);
    const r = await accept(token, { fullName: "X", password: "Invited-pass-1" });
    assert.equal(r.status, 410);
    assert.equal(r.data.reason, "REVOKED");
  });

  test("an expired invitation is refused, and resending rotates the token", async () => {
    const created = await invite(newEmail("expire"));
    const id = created.data.invitation.id;
    const oldToken = forgeInvitationToken(id, { expired: true });
    const expired = await accept(oldToken, { fullName: "X", password: "Invited-pass-1" });
    assert.equal(expired.status, 410);
    assert.equal(expired.data.reason, "EXPIRED");

    const list = await api("GET", `/api/roadmaps/${roadmapId}/invitations`, mentor.token);
    assert.equal(list.data.find((entry: any) => entry.id === id).state, "EXPIRED");

    // An expired row is still PENDING in storage, so inviting again re-arms it.
    const again = await invite(created.data.invitation.email);
    assert.equal(again.data.invitation.id, id);
    assert.equal((await accept(oldToken, { fullName: "X", password: "Invited-pass-1" })).status, 404);
  });

  test("resending rotates the token: the previous link stops working", async () => {
    const created = await invite(newEmail("resend"));
    const id = created.data.invitation.id;
    const oldToken = forgeInvitationToken(id);
    const resent = await api("POST", `/api/invitations/${id}/resend`, mentor.token);
    assert.equal(resent.status, 200, JSON.stringify(resent.data));
    assert.equal(resent.data.invitation.sendCount, 2);
    assert.equal((await api("GET", `/api/invitations/token/${oldToken}`)).status, 404);
  });

  test("two concurrent acceptances create exactly one account", async () => {
    const created = await invite(newEmail("race"));
    const token = forgeInvitationToken(created.data.invitation.id);
    const results = await Promise.all(
      [1, 2].map((n) => accept(token, { fullName: `Racer ${n}`, password: "Invited-pass-1" })),
    );
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 410], JSON.stringify(results.map((r) => r.data)));
  });

  describe("access control", () => {
    let pendingId: number;
    before(async () => {
      pendingId = (await invite(newEmail("acl"))).data.invitation.id;
    });

    expectAccess(
      {
        none: () => undefined,
        learner: () => learner.token,
        owner: () => mentor.token,
        otherMentor: () => otherMentor.token,
      },
      [
        ["POST", () => `/api/roadmaps/${roadmapId}/invitations`, "none", { email: "a@it.test" }, 401],
        ["POST", () => `/api/roadmaps/${roadmapId}/invitations`, "learner", { email: "a@it.test" }, 403],
        ["POST", () => `/api/roadmaps/${roadmapId}/invitations`, "otherMentor", { email: "a@it.test" }, 404],
        ["GET", () => `/api/roadmaps/${roadmapId}/invitations`, "none", undefined, 401],
        ["GET", () => `/api/roadmaps/${roadmapId}/invitations`, "learner", undefined, 403],
        ["GET", () => `/api/roadmaps/${roadmapId}/invitations`, "otherMentor", undefined, 404],
        ["POST", () => `/api/invitations/${pendingId}/resend`, "none", undefined, 401],
        ["POST", () => `/api/invitations/${pendingId}/resend`, "learner", undefined, 403],
        ["POST", () => `/api/invitations/${pendingId}/resend`, "otherMentor", undefined, 404],
        ["DELETE", () => `/api/invitations/${pendingId}`, "none", undefined, 401],
        ["DELETE", () => `/api/invitations/${pendingId}`, "learner", undefined, 403],
        ["DELETE", () => `/api/invitations/${pendingId}`, "otherMentor", undefined, 404],
      ],
    );
  });
});
