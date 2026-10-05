// Integration test of the mentor / learner journey against a running server.
//   TEST_BASE_URL=http://localhost:5055 npm run test:integration
// The server must run with NODE_ENV=development (the test mentor account is
// provisioned through /api/auth/create-test-users) on a disposable database.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const BASE = process.env.TEST_BASE_URL;
const run = `${Date.now()}`;
const PASSWORD = "Test123!";

type Json = Record<string, any>;

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function register(name: string, extra: Json = {}) {
  const r = await api("POST", "/api/auth/register", undefined, {
    fullName: name,
    email: `${name.toLowerCase().replace(/\s/g, "")}.${run}@it.test`,
    password: PASSWORD,
    ...extra,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token as string, user: r.data.user as Json };
}

describe("mentor / learner journey", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: string;
  let learnerA: { token: string; user: Json };
  let learnerB: { token: string; user: Json };
  let roadmapId: number;
  let weekId: number;
  let taskId: number;

  before(async () => {
    await api("POST", "/api/auth/create-test-users");
    const login = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: PASSWORD,
    });
    assert.equal(login.status, 200, "mentor@test.com login");
    mentor = login.data.token;
    learnerA = await register("Learner A");
    learnerB = await register("Learner B");
  });

  test("public registration cannot elevate the role", async () => {
    const r = await api("POST", "/api/auth/register", undefined, {
      fullName: "Sneaky",
      email: `sneaky.${run}@it.test`,
      password: PASSWORD,
      role: "MENTOR",
    });
    assert.equal(r.status, 400, "unknown keys are rejected as a client error");
    const ok = await register("Plain User");
    assert.equal(ok.user.role, "LEARNER");
  });

  test("login rejects a wrong password; endpoints require a token", async () => {
    const bad = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: "nope",
    });
    assert.equal(bad.status, 401);
    assert.equal((await api("GET", "/api/roadmaps")).status, 401);
  });

  test("a learner cannot create a roadmap; a mentor can", async () => {
    const denied = await api("POST", "/api/roadmaps", learnerA.token, { title: "x" });
    assert.equal(denied.status, 403);

    const ok = await api("POST", "/api/roadmaps", mentor, {
      title: `Backend ${run}`,
      description: "integration",
    });
    assert.equal(ok.status, 201, JSON.stringify(ok.data));
    roadmapId = ok.data.id;
  });

  test("mentor builds week > objective > task", async () => {
    const w = await api("POST", "/api/weeks", mentor, {
      roadmapId,
      number: 1,
      title: "Semaine 1",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
    assert.equal(w.status, 201, JSON.stringify(w.data));
    weekId = w.data.id;

    const o = await api("POST", `/api/weeks/${weekId}/objectives`, mentor, {
      title: "Bases Python",
      type: "OTHER",
    });
    assert.equal(o.status, 201, JSON.stringify(o.data));

    const t = await api("POST", `/api/objectives/${o.data.id}/tasks`, mentor, {
      label: "Lire la doc",
    });
    assert.equal(t.status, 201, JSON.stringify(t.data));
    taskId = t.data.id;
  });

  test("a learner cannot edit the roadmap content", async () => {
    const r = await api("POST", "/api/weeks", learnerA.token, {
      roadmapId,
      number: 9,
      title: "hack",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
    assert.equal(r.status, 403);
  });

  test("access requires an explicit mentorship", async () => {
    const before = await api("GET", `/api/roadmaps/${roadmapId}`, learnerA.token);
    assert.equal(before.status, 404, "no mentorship yet");

    const link = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, {
      learnerId: learnerA.user.id,
    });
    assert.ok([200, 201].includes(link.status), JSON.stringify(link.data));

    const again = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, {
      learnerId: learnerA.user.id,
    });
    assert.equal(again.status, 200, "mentorship creation is idempotent");

    assert.equal((await api("GET", `/api/roadmaps/${roadmapId}`, learnerA.token)).status, 200);
    assert.equal((await api("GET", `/api/roadmaps/${roadmapId}`, learnerB.token)).status, 404);

    const listA = await api("GET", "/api/roadmaps", learnerA.token);
    const listB = await api("GET", "/api/roadmaps", learnerB.token);
    assert.ok(listA.data.some((r: Json) => r.id === roadmapId));
    assert.ok(!listB.data.some((r: Json) => r.id === roadmapId));
  });

  test("a learner only reaches a week once the mentor validated it", async () => {
    assert.equal((await api("GET", `/api/weeks/${weekId}`, learnerA.token)).status, 404);
    assert.equal(
      (await api("POST", `/api/tasks/${taskId}/toggle-progress`, learnerA.token, {})).status,
      404,
      "no progress on an unvalidated week",
    );
    const list = await api("GET", "/api/weeks", learnerA.token);
    assert.ok(!list.data.some((w: Json) => w.id === weekId));

    assert.equal((await api("POST", `/api/weeks/${weekId}/validate`, mentor)).status, 200);
  });

  test("mentee A sees the week; mentee B does not", async () => {
    assert.equal((await api("GET", `/api/weeks/${weekId}`, learnerA.token)).status, 200);
    assert.equal((await api("GET", `/api/weeks/${weekId}`, learnerB.token)).status, 404);
  });

  test("only the assigned learner toggles task progress", async () => {
    const done = await api("POST", `/api/tasks/${taskId}/toggle-progress`, learnerA.token, {});
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.isDone, true);

    assert.equal(
      (await api("POST", `/api/tasks/${taskId}/toggle-progress`, learnerB.token, {})).status,
      404,
    );
    assert.equal(
      (await api("POST", `/api/tasks/${taskId}/toggle-progress`, mentor, {})).status,
      403,
    );

    const undone = await api("POST", `/api/tasks/${taskId}/toggle-progress`, learnerA.token, {});
    assert.equal(undone.data.isDone, false, "toggle flips back");
    await api("POST", `/api/tasks/${taskId}/toggle-progress`, learnerA.token, {});
  });

  test("learner comments, mentor reads, mentor cannot comment", async () => {
    const c = await api("POST", `/api/weeks/${weekId}/comments`, learnerA.token, {
      content: "Question sur la semaine 1",
    });
    assert.equal(c.status, 201, JSON.stringify(c.data));

    assert.equal(
      (await api("POST", `/api/weeks/${weekId}/comments`, mentor, { content: "x" })).status,
      403,
    );
    assert.equal(
      (await api("POST", `/api/weeks/${weekId}/comments`, learnerB.token, { content: "x" })).status,
      404,
    );

    const list = await api("GET", `/api/weeks/${weekId}/comments`, mentor);
    assert.equal(list.status, 200);
    assert.ok(list.data.some((x: Json) => x.content === "Question sur la semaine 1"));
  });

  test("only a mentor validates a week", async () => {
    assert.equal((await api("POST", `/api/weeks/${weekId}/validate`, learnerA.token)).status, 403);

    const v = await api("POST", `/api/weeks/${weekId}/validate`, mentor);
    assert.equal(v.status, 200, JSON.stringify(v.data));
    assert.equal(v.data.isValidatedByMentor, true);

    const seen = await api("GET", `/api/weeks/${weekId}`, learnerA.token);
    assert.equal(seen.data.isValidatedByMentor, true);
  });

  test("progress summary is reachable by the learner", async () => {
    const s = await api("GET", "/api/progress/summary", learnerA.token);
    assert.equal(s.status, 200, JSON.stringify(s.data));
  });
});
