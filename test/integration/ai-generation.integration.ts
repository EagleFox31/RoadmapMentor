// Calls the configured AI provider (costs tokens): opt-in with TEST_AI=1.
//   TEST_BASE_URL=http://localhost:5055 TEST_AI=1 npm run test:integration
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { api, BASE, run } from "./support/api";

const enabled = !!BASE && process.env.TEST_AI === "1";

describe("AI roadmap generation", { skip: !enabled && "set TEST_BASE_URL and TEST_AI=1" }, () => {
  test("generates weeks and saves them atomically into a roadmap", { timeout: 240_000 }, async () => {
    await api("POST", "/api/auth/create-test-users");
    const login = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: "Test123!",
    });
    const mentor = login.data.token;

    const gen = await api("POST", "/api/ai/generate-roadmap", mentor, {
      topic: "Introduction à SQL",
      numberOfWeeks: 2,
      skillLevel: "débutant",
    });
    assert.equal(gen.status, 200, JSON.stringify(gen.data).slice(0, 400));
    const weeks = gen.data.weeks as any[];
    assert.equal(weeks.length, 2);
    for (const w of weeks) {
      assert.ok(w.title && w.objectives?.length > 0, "each week has a title and objectives");
      assert.ok(w.objectives.every((o: any) => o.tasks?.length > 0), "each objective has tasks");
    }

    const roadmap = await api("POST", "/api/roadmaps", mentor, { title: `AI ${Date.now()}` });
    assert.equal(roadmap.status, 201);

    const payload = weeks.map((week) => ({
      ...week,
      roadmapId: roadmap.data.id,
      number: week.weekNumber,
      objectives: week.objectives.map((o: any, i: number) => ({
        ...o,
        orderIndex: o.orderIndex ?? i,
        tasks: o.tasks.map((t: any, j: number) => ({ ...t, orderIndex: t.orderIndex ?? j })),
      })),
    }));
    const saved = await api("POST", "/api/weeks/bulk", mentor, payload);
    assert.equal(saved.status, 201, JSON.stringify(saved.data).slice(0, 400));
    assert.equal(saved.data.weeks.length, 2);

    const list = await api("GET", `/api/weeks?roadmapId=${roadmap.data.id}`, mentor);
    assert.equal(list.data.length, 2);
  });
});
