import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const BASE = process.env.TEST_BASE_URL;
const PASSWORD = "Test123!";
const run = Date.now().toString(36);

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

describe("active roadmap scoping", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: string;
  let learner: string;
  let roadmapA: number;
  let roadmapB: number;
  let weekA: number;

  before(async () => {
    await api("POST", "/api/auth/create-test-users");
    const login = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    mentor = login.data.token;

    const reg = await api("POST", "/api/auth/register", undefined, {
      fullName: "Context Learner",
      email: `context.${run}@it.test`,
      password: PASSWORD,
    });
    assert.equal(reg.status, 201);
    learner = reg.data.token;

    const a = await api("POST", "/api/roadmaps", mentor, { title: `Context A ${run}` });
    const b = await api("POST", "/api/roadmaps", mentor, { title: `Context B ${run}` });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    roadmapA = a.data.id;
    roadmapB = b.data.id;

    for (const [roadmapId, title] of [
      [roadmapA, "Semaine A"],
      [roadmapB, "Semaine B"],
    ] as const) {
      const week = await api("POST", "/api/weeks", mentor, { roadmapId, number: 1, title, startDate: "2026-01-05", endDate: "2026-01-11" });
      assert.equal(week.status, 201, JSON.stringify(week.data));
      if (roadmapId === roadmapA) weekA = week.data.id;
    }
  });

  test("weeks and progress are scoped to the requested roadmap", async () => {
    const weeksA = await api("GET", `/api/weeks?roadmapId=${roadmapA}`, mentor);
    assert.equal(weeksA.status, 200);
    assert.deepEqual(weeksA.data.map((w: Json) => w.title), ["Semaine A"]);

    const summaryA = await api("GET", `/api/progress/summary?roadmapId=${roadmapA}`, mentor);
    assert.equal(summaryA.status, 200);
    assert.equal(summaryA.data.totalTasks, 0);
  });

  test("a week created without roadmapId is refused when several roadmaps exist", async () => {
    const res = await api("POST", "/api/weeks", mentor, { number: 2, title: "Orpheline", startDate: "2026-01-12", endDate: "2026-01-18" });
    assert.equal(res.status, 400, JSON.stringify(res.data));
  });

  test("a foreign roadmap is a 404 for weeks and progress", async () => {
    assert.equal((await api("GET", `/api/weeks?roadmapId=${roadmapA}`, learner)).status, 404);
    assert.equal((await api("GET", `/api/progress/summary?roadmapId=${roadmapA}`, learner)).status, 404);
    assert.equal((await api("GET", `/api/roadmaps/${roadmapA}`, learner)).status, 404);
  });

  test("a week of a foreign roadmap is a 404 for every week route", async () => {
    assert.equal((await api("GET", `/api/weeks/${weekA}`, mentor)).status, 200);
    assert.equal((await api("GET", `/api/weeks/${weekA}`, learner)).status, 404);
    assert.equal((await api("GET", `/api/weeks/${weekA}/comments`, learner)).status, 404);
    assert.equal((await api("POST", `/api/weeks/${weekA}/comments`, learner, { content: "x" })).status, 404);
  });

  test("an invalid roadmapId is a 400 for progress", async () => {
    assert.equal((await api("GET", "/api/progress/summary?roadmapId=abc", mentor)).status, 400);
  });
});
