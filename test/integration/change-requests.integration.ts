import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { api, BASE, createPackage, expectAccess, mentoringFixture, type MentoringFixture } from "./support/api";

describe("packages and change requests", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let f: MentoringFixture;
  let packageId: number;
  let taskId: number;
  let foreignTaskId: number;
  const crBase = () => `/api/mentorships/${f.mentorshipId}/change-requests`;

  const propose = async (title = "Ajouter un module") => {
    const res = await api("POST", crBase(), f.learner.token, { packageId, title, description: "Détails" });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.status, "PROPOSED");
    return res.data.id as number;
  };
  const quote = (id: number, token = f.mentorA.token, linkedTaskId = taskId) =>
    api("POST", `/api/change-requests/${id}/quote`, token, { quotedPriceMinor: 25000, currency: "xaf", linkedTaskId });

  async function seedTask(token: string, roadmapId: number): Promise<number> {
    const res = await api("POST", "/api/weeks/bulk", token, [
      {
        roadmapId,
        number: 1,
        title: "Semaine CR",
        startDate: "2026-03-02",
        endDate: "2026-03-08",
        objectives: [{ type: "OTHER", title: "Obj", orderIndex: 0, tasks: [{ label: "Tâche liée", orderIndex: 0 }] }],
      },
    ]);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const weeks = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, token);
    return weeks.data[0].objectives[0].tasks[0].id;
  }

  before(async () => {
    f = await mentoringFixture("crs");
    packageId = (await createPackage(f)).id;
    taskId = await seedTask(f.mentorA.token, f.roadmapId);
    const other = await api("POST", "/api/roadmaps", f.mentorB.token, { title: `Other ${Date.now()}` });
    foreignTaskId = await seedTask(f.mentorB.token, other.data.id);
  });

  test("packages: created with scope, listed for both parties, validated", async () => {
    const list = await api("GET", `/api/mentorships/${f.mentorshipId}/packages`, f.learner.token);
    assert.equal(list.status, 200);
    assert.ok(list.data.some((p: any) => p.id === packageId));

    const bad = (body: Record<string, unknown>) => api("POST", `/api/mentorships/${f.mentorshipId}/packages`, f.mentorA.token, body);
    assert.equal((await bad({ title: "x" })).status, 400);
    assert.equal((await bad({
      title: "x", basePriceMinor: 1, currency: "XAF", periodStart: "2026-03-31", periodEnd: "2026-03-01",
      includedSessionCount: 1, scopeDescription: "d", scopeItems: [{ title: "i" }],
    })).status, 400);
  });

  test("full lifecycle: propose, quote, accept, deliver", async () => {
    const id = await propose();
    const quoted = await quote(id);
    assert.equal(quoted.status, 200, JSON.stringify(quoted.data));
    assert.equal(quoted.data.status, "QUOTED");
    assert.equal(quoted.data.quotedPriceMinor, 25000);
    assert.equal(quoted.data.currency, "XAF");

    const accepted = await api("POST", `/api/change-requests/${id}/decision`, f.learner.token, { decision: "ACCEPT" });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.equal(accepted.data.status, "ACCEPTED");

    const delivered = await api("POST", `/api/change-requests/${id}/deliver`, f.mentorA.token);
    assert.equal(delivered.status, 200, JSON.stringify(delivered.data));
    assert.equal(delivered.data.status, "DELIVERED");

    const listed = await api("GET", crBase(), f.mentorA.token);
    assert.equal(listed.data.find((r: any) => r.id === id).status, "DELIVERED");
  });

  test("a rejected request cannot be revived", async () => {
    const id = await propose("À refuser");
    assert.equal((await quote(id)).status, 200);
    const rejected = await api("POST", `/api/change-requests/${id}/decision`, f.learner.token, { decision: "REJECT" });
    assert.equal(rejected.data.status, "REJECTED");
    assert.equal((await api("POST", `/api/change-requests/${id}/decision`, f.learner.token, { decision: "ACCEPT" })).status, 409);
    assert.equal((await api("POST", `/api/change-requests/${id}/deliver`, f.mentorA.token)).status, 409);
  });

  test("invalid transitions and inputs are 4xx, never 500", async () => {
    const id = await propose("Transitions");
    assert.equal((await api("POST", `/api/change-requests/${id}/deliver`, f.mentorA.token)).status, 409, "deliver before quote");
    assert.equal((await api("POST", `/api/change-requests/${id}/decision`, f.learner.token, { decision: "ACCEPT" })).status, 409, "decide before quote");
    assert.equal((await quote(id, f.mentorA.token, foreignTaskId)).status, 400, "task of another roadmap");
    assert.equal((await quote(id)).status, 200);
    assert.equal((await quote(id)).status, 409, "double quote");
    assert.equal((await api("POST", `/api/change-requests/${id}/decision`, f.learner.token, { decision: "MAYBE" })).status, 400);
    assert.equal((await api("POST", crBase(), f.learner.token, { packageId: 999999, title: "x", description: "y" })).status, 400);
    assert.equal((await api("POST", crBase(), f.learner.token, { packageId, title: "", description: "y" })).status, 400);
  });

  describe("access matrix", () => {
    let pending: number;
    before(async () => {
      pending = await propose("Matrice");
    });
    const pkgs = () => `/api/mentorships/${f.mentorshipId}/packages`;
    const crs = () => `/api/mentorships/${f.mentorshipId}/change-requests`;
    const quotePath = () => `/api/change-requests/${pending}/quote`;
    const decisionPath = () => `/api/change-requests/${pending}/decision`;
    const deliverPath = () => `/api/change-requests/${pending}/deliver`;
    const quoteBody = () => ({ quotedPriceMinor: 1, currency: "XAF", linkedTaskId: taskId });
    expectAccess(f_tokens(), [
      ["GET", pkgs, "outsider", undefined, 404],
      ["GET", pkgs, "mentorB", undefined, 404],
      ["GET", pkgs, "anonymous", undefined, 401],
      ["POST", pkgs, "learner", { title: "x" }, 403],
      ["POST", pkgs, "mentorB", { title: "x" }, 404],
      ["GET", crs, "outsider", undefined, 404],
      ["GET", crs, "mentorB", undefined, 404],
      // Only the mentorship learner raises requests; mentors cannot.
      ["POST", crs, "mentorA", { packageId: 1, title: "x", description: "y" }, 403],
      ["POST", crs, "outsider", { packageId: 1, title: "x", description: "y" }, 404],
      // Quote and deliver are mentor-only; decision is learner-only.
      ["POST", quotePath, "learner", quoteBody(), 403],
      ["POST", quotePath, "mentorB", quoteBody(), 404],
      ["POST", decisionPath, "mentorA", { decision: "ACCEPT" }, 403],
      ["POST", decisionPath, "outsider", { decision: "ACCEPT" }, 404],
      ["POST", deliverPath, "learner", undefined, 403],
      ["POST", deliverPath, "mentorB", undefined, 404],
    ]);

    test("denied calls left the request untouched", async () => {
      const list = await api("GET", crs(), f.mentorA.token);
      assert.equal(list.data.find((r: any) => r.id === pending).status, "PROPOSED");
    });
  });

  // Tokens are resolved lazily because the fixture only exists after before().
  function f_tokens(): MentoringFixture["tokens"] {
    return {
      mentorA: () => f.tokens.mentorA(),
      mentorB: () => f.tokens.mentorB(),
      learner: () => f.tokens.learner(),
      outsider: () => f.tokens.outsider(),
      anonymous: () => undefined,
    };
  }
});
