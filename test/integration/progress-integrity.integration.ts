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

async function register(label: string) {
  const r = await api("POST", "/api/auth/register", undefined, {
    fullName: label,
    email: `${label.replace(/\s/g, "").toLowerCase()}.${run}@it.test`,
    password: PASSWORD,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token as string, id: r.data.user.id as number };
}

describe("task progress integrity", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: string;
  let learnerA: { token: string; id: number };
  let learnerB: { token: string; id: number };
  let roadmapId: number;
  let weekId: number;
  const taskIds: number[] = [];

  before(async () => {
    await api("POST", "/api/auth/create-test-users");
    const login = await api("POST", "/api/auth/login", undefined, {
      email: "mentor@test.com",
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    mentor = login.data.token;
    learnerA = await register("Progress A");
    learnerB = await register("Progress B");

    const rm = await api("POST", "/api/roadmaps", mentor, { title: `Progress ${run}` });
    roadmapId = rm.data.id;
    for (const learner of [learnerA, learnerB]) {
      const link = await api("POST", `/api/roadmaps/${roadmapId}/mentorships`, mentor, {
        learnerId: learner.id,
      });
      assert.ok([200, 201].includes(link.status), JSON.stringify(link.data));
    }

    const w = await api("POST", "/api/weeks", mentor, {
      roadmapId,
      number: 1,
      title: "Semaine 1",
      startDate: "2026-10-05",
      endDate: "2026-10-11",
    });
    weekId = w.data.id;
    for (let o = 0; o < 3; o++) {
      const obj = await api("POST", `/api/weeks/${weekId}/objectives`, mentor, {
        title: `Objectif ${o}`,
        type: "OTHER",
        orderIndex: o,
      });
      assert.equal(obj.status, 201, JSON.stringify(obj.data));
      for (let t = 0; t < 3; t++) {
        const task = await api("POST", `/api/objectives/${obj.data.id}/tasks`, mentor, {
          label: `Tâche ${o}.${t}`,
          orderIndex: t,
        });
        assert.equal(task.status, 201, JSON.stringify(task.data));
        taskIds.push(task.data.id);
      }
    }
    assert.equal((await api("POST", `/api/weeks/${weekId}/validate`, mentor)).status, 200);
  });

  const loadWeek = async (token: string) => {
    const r = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, token);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.find((w: Json) => w.id === weekId) as Json;
  };

  test("concurrent toggles never create two rows for the same learner and task", async () => {
    const target = taskIds[0];
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        api("POST", `/api/tasks/${target}/toggle-progress`, learnerA.token, {}),
      ),
    );
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)));

    const week = await loadWeek(mentor);
    const task = week.objectives.flatMap((o: Json) => o.tasks).find((t: Json) => t.id === target);
    const rowsForA = task.progress.filter((p: Json) => p.learnerId === learnerA.id);
    assert.equal(rowsForA.length, 1, "a single progress row");
    assert.equal(rowsForA[0].isDone, false, "an even number of toggles ends undone");
    assert.equal(rowsForA[0].doneAt, null);
  });

  test("the week payload keeps order, nesting and per-learner scoping", async () => {
    await api("POST", `/api/tasks/${taskIds[1]}/toggle-progress`, learnerA.token, {});
    await api("POST", `/api/tasks/${taskIds[1]}/toggle-progress`, learnerB.token, {});
    assert.equal(
      (await api("POST", `/api/weeks/${weekId}/comments`, learnerA.token, { content: "A" })).status,
      201,
    );

    const asMentor = await loadWeek(mentor);
    assert.deepEqual(
      asMentor.objectives.map((o: Json) => o.title),
      ["Objectif 0", "Objectif 1", "Objectif 2"],
    );
    assert.deepEqual(
      asMentor.objectives[0].tasks.map((t: Json) => t.label),
      ["Tâche 0.0", "Tâche 0.1", "Tâche 0.2"],
    );
    const mentorTask = asMentor.objectives[0].tasks[1];
    assert.deepEqual(mentorTask.progress.map((p: Json) => p.learnerId).sort(), [learnerA.id, learnerB.id].sort());
    assert.ok(mentorTask.progress.every((p: Json) => p.learner?.fullName));
    assert.equal(asMentor.comments.length, 1);
    assert.equal(asMentor.comments[0].learner.id, learnerA.id);

    const asB = await loadWeek(learnerB.token);
    const bTask = asB.objectives[0].tasks[1];
    assert.deepEqual(bTask.progress.map((p: Json) => p.learnerId), [learnerB.id]);
    assert.equal(asB.comments.length, 0, "a learner never sees another learner's comments");
    assert.equal(asB.objectives[0].tasks[0].progress.length, 0);
  });
});
