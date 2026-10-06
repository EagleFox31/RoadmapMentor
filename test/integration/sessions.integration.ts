import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { api, BASE, createPackage, expectAccess, mentoringFixture, type MentoringFixture } from "./support/api";

const slot = (day: number) => ({
  startsAt: `2026-03-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  endsAt: `2026-03-${String(day).padStart(2, "0")}T11:00:00.000Z`,
});

describe("mentoring sessions", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let f: MentoringFixture;
  let packageId: number;
  let sessionId: number;
  let cancelledId: number;
  let completedId: number;

  const create = async (day: number, title: string) => {
    const res = await api("POST", `/api/mentorships/${f.mentorshipId}/sessions`, f.mentorA.token, { title, packageId, ...slot(day) });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data.id as number;
  };

  before(async () => {
    f = await mentoringFixture("sessions");
    packageId = (await createPackage(f)).id;
    sessionId = await create(2, "Séance active");
    cancelledId = await create(3, "Séance annulée");
    completedId = await create(4, "Séance terminée");
  });

  test("lifecycle: schedule, list, complete, cancel", async () => {
    const listed = await api("GET", `/api/mentorships/${f.mentorshipId}/sessions`, f.learner.token);
    assert.equal(listed.status, 200);
    assert.ok(listed.data.sessions.some((s: any) => s.id === sessionId));

    const march = await api("GET", `/api/mentorships/${f.mentorshipId}/sessions?month=2026-03`, f.mentorA.token);
    assert.equal(march.data.sessions.length, 3);
    const april = await api("GET", `/api/mentorships/${f.mentorshipId}/sessions?month=2026-04`, f.mentorA.token);
    assert.equal(april.data.sessions.length, 0);
    assert.equal((await api("GET", `/api/mentorships/${f.mentorshipId}/sessions?month=bad`, f.mentorA.token)).status, 400);

    const cancelled = await api("POST", `/api/sessions/${cancelledId}/cancel`, f.mentorA.token);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.status, "CANCELLED");

    const done = await api("POST", `/api/sessions/${completedId}/complete`, f.mentorA.token, { learnerAttended: true, mentorNotes: "ok" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.learnerAttended, true);
  });

  test("invalid input and invalid transitions are 4xx, never 500", async () => {
    const base = `/api/mentorships/${f.mentorshipId}/sessions`;
    assert.equal((await api("POST", base, f.mentorA.token, { title: "x", packageId, startsAt: slot(5).endsAt, endsAt: slot(5).startsAt })).status, 400);
    assert.equal((await api("POST", base, f.mentorA.token, { title: "", packageId, ...slot(5) })).status, 400);
    assert.equal((await api("POST", base, f.mentorA.token, { title: "x", packageId: 999999, ...slot(5) })).status, 400);
    assert.equal((await api("POST", base, f.mentorA.token, { title: "x", packageId, weekId: 999999, ...slot(5) })).status, 400);
    assert.equal((await api("POST", `/api/sessions/${cancelledId}/complete`, f.mentorA.token, { learnerAttended: true })).status, 409);
    assert.equal((await api("POST", `/api/sessions/${completedId}/cancel`, f.mentorA.token)).status, 409);
    assert.equal((await api("POST", `/api/sessions/${sessionId}/complete`, f.mentorA.token, {})).status, 400);
    assert.equal((await api("GET", "/api/mentorships/abc/sessions", f.mentorA.token)).status, 400);
  });

  describe("access matrix", () => {
    const sessions = () => `/api/mentorships/${f.mentorshipId}/sessions`;
    const complete = () => `/api/sessions/${sessionId}/complete`;
    const cancel = () => `/api/sessions/${sessionId}/cancel`;
    const body = { learnerAttended: true };
    const tokens: MentoringFixture["tokens"] = {
      mentorA: () => f.tokens.mentorA(),
      mentorB: () => f.tokens.mentorB(),
      learner: () => f.tokens.learner(),
      outsider: () => f.tokens.outsider(),
      anonymous: () => undefined,
    };
    expectAccess(tokens, [
      ["GET", sessions, "learner", undefined, 200],
      ["GET", sessions, "outsider", undefined, 404],
      ["GET", sessions, "mentorB", undefined, 404],
      ["GET", sessions, "anonymous", undefined, 401],
      ["POST", sessions, "learner", { title: "x", packageId, ...slot(8) }, 403],
      ["POST", sessions, "mentorB", { title: "x", packageId, ...slot(8) }, 404],
      ["POST", complete, "learner", body, 403],
      ["POST", cancel, "learner", undefined, 403],
      ["POST", complete, "mentorB", body, 404],
      ["POST", cancel, "mentorB", undefined, 404],
      ["POST", complete, "anonymous", body, 401],
    ]);

    test("a foreign mentor leaves the session untouched", async () => {
      const list = await api("GET", sessions(), f.mentorA.token);
      assert.equal(list.data.sessions.find((s: any) => s.id === sessionId)?.status, "SCHEDULED");
    });
  });
});
