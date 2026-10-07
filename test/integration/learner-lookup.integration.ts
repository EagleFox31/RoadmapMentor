import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { api, BASE, PASSWORD, run } from "./support/api";


type Json = Record<string, any>;

describe("mentor attaches a learner by email", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: string;
  let mentorId: number;
  let learner: { token: string; id: number; email: string };
  let roadmapId: number;

  before(async () => {
    await api("POST", "/api/auth/create-test-users");
    const login = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    mentor = login.data.token;
    mentorId = login.data.user.id;

    const email = `lookup.${run}@it.test`;
    const reg = await api("POST", "/api/auth/register", undefined, {
      fullName: "Lookup Learner",
      email,
      password: PASSWORD,
    });
    assert.equal(reg.status, 201);
    learner = { token: reg.data.token, id: reg.data.user.id, email };

    const roadmap = await api("POST", "/api/roadmaps", mentor, { title: `Lookup ${run}` });
    assert.equal(roadmap.status, 201);
    roadmapId = roadmap.data.id;
  });

  test("lookup requires a mentor", async () => {
    const q = `/api/learners/lookup?email=${encodeURIComponent(learner.email)}`;
    assert.equal((await api("GET", q)).status, 401);
    assert.equal((await api("GET", q, learner.token)).status, 403);
  });

  test("lookup returns only the minimal learner profile", async () => {
    const r = await api("GET", `/api/learners/lookup?email=${encodeURIComponent(learner.email)}`, mentor);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.deepEqual(Object.keys(r.data).sort(), ["email", "fullName", "id"]);
    assert.equal(r.data.id, learner.id);
  });

  test("lookup does not reveal mentors or unknown accounts", async () => {
    const mentorLookup = await api("GET", "/api/learners/lookup?email=mentor%40test.com", mentor);
    const unknown = await api("GET", "/api/learners/lookup?email=nobody%40it.test", mentor);
    assert.equal(mentorLookup.status, 404);
    assert.equal(unknown.status, 404);
    // requestId diffère forcément d'une requête à l'autre : il ne doit pas révéler l'existence du compte
    const { requestId: _a, ...mentorBody } = mentorLookup.data as Record<string, unknown>;
    const { requestId: _b, ...unknownBody } = unknown.data as Record<string, unknown>;
    assert.deepEqual(mentorBody, unknownBody);
    assert.equal((await api("GET", "/api/learners/lookup?email=", mentor)).status, 400);
  });

  test("a mentor cannot attach a non-learner", async () => {
    const r = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, { learnerId: mentorId });
    assert.equal(r.status, 400, JSON.stringify(r.data));
  });

  test("attaching exposes the roadmap to the learner, and repeating is a no-op", async () => {
    const first = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, { learnerId: learner.id });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const again = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, { learnerId: learner.id });
    assert.equal(again.status, 200);
    assert.equal(again.data.id, first.data.id);

    const mine = await api("GET", "/api/mentorships", learner.token);
    assert.ok(mine.data.some((m: Json) => m.roadmapId === roadmapId && m.status === "ACTIVE"));
  });

  test("a learner cannot attach anyone", async () => {
    const r = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, learner.token, { learnerId: learner.id });
    assert.equal(r.status, 403);
  });
});
