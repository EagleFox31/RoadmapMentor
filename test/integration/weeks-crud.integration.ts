import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { api, BASE, ensureMentor, expectAccess, register, registerCleanup, track, type Actor } from "./support/api";

const dates = { startDate: "2026-02-02", endDate: "2026-02-08" };

describe("weeks CRUD and access", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentorA: Actor;
  let mentorB: Actor;
  let learner: Actor;
  let outsider: Actor;
  let roadmapA: number;
  let roadmapB: number;
  let draftWeek: number;
  let learnerWeek: number;
  const tokens = {
    mentorA: () => mentorA.token,
    mentorB: () => mentorB.token,
    learner: () => learner.token,
    outsider: () => outsider.token,
    anonymous: () => undefined,
  };

  registerCleanup();

  before(async () => {
    mentorA = await ensureMentor("weeksa");
    mentorB = await ensureMentor("weeksb");
    learner = await register("weeks.learner");
    outsider = await register("weeks.outsider");

    const a = await api("POST", "/api/roadmaps", mentorA.token, { title: `Weeks A ${Date.now()}` });
    const b = await api("POST", "/api/roadmaps", mentorB.token, { title: `Weeks B ${Date.now()}` });
    assert.equal(a.status, 201, JSON.stringify(a.data));
    assert.equal(b.status, 201, JSON.stringify(b.data));
    roadmapA = a.data.id;
    roadmapB = b.data.id;

    const link = await api("POST", `/api/roadmaps/${roadmapA}/mentorships`, mentorA.token, { learnerId: learner.id });
    assert.ok([200, 201].includes(link.status), JSON.stringify(link.data));

    const draft = await api("POST", "/api/weeks", mentorA.token, { roadmapId: roadmapA, number: 1, title: "Brouillon", ...dates });
    assert.equal(draft.status, 201, JSON.stringify(draft.data));
    draftWeek = draft.data.id;
    track(`/api/weeks/${draftWeek}`, mentorA.token);
  });

  describe("owner mentor lifecycle", () => {
    test("create, update, validate, clone then delete", async () => {
      const created = await api("POST", "/api/weeks", mentorA.token, { roadmapId: roadmapA, number: 2, title: "Cycle", ...dates });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const id = created.data.id;
      assert.equal(created.data.isValidatedByMentor, false);

      const updated = await api("PUT", `/api/weeks/${id}`, mentorA.token, { title: "Cycle modifié" });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      assert.equal(updated.data.title, "Cycle modifié");

      const validated = await api("POST", `/api/weeks/${id}/validate`, mentorA.token);
      assert.equal(validated.status, 200, JSON.stringify(validated.data));
      assert.equal(validated.data.isValidatedByMentor, true);
      learnerWeek = id;

      const clone = await api("POST", `/api/weeks/${id}/clone`, mentorA.token, { newNumber: 3 });
      assert.equal(clone.status, 201, JSON.stringify(clone.data));
      assert.notEqual(clone.data.id, id);
      assert.equal((await api("POST", `/api/weeks/${id}/clone`, mentorA.token, {})).status, 400);

      assert.equal((await api("DELETE", `/api/weeks/${clone.data.id}`, mentorA.token)).status, 204);
      assert.equal((await api("GET", `/api/weeks/${clone.data.id}`, mentorA.token)).status, 404);
      track(`/api/weeks/${id}`, mentorA.token);
    });

    test("bulk creation persists nested content", async () => {
      const res = await api("POST", "/api/weeks/bulk", mentorA.token, [
        {
          roadmapId: roadmapA,
          number: 10,
          title: "Bulk",
          ...dates,
          objectives: [{ type: "OTHER", title: "Objectif", orderIndex: 0, tasks: [{ label: "Tâche", orderIndex: 0 }] }],
        },
      ]);
      assert.equal(res.status, 201, JSON.stringify(res.data));
      const weeks = await api("GET", `/api/weeks?roadmapId=${roadmapA}`, mentorA.token);
      const bulk = weeks.data.find((w: any) => w.title === "Bulk");
      assert.ok(bulk, "bulk week is listed");
      assert.equal(bulk.objectives[0].tasks.length, 1);
      track(`/api/weeks/${bulk.id}`, mentorA.token);
    });

    test("bulk creation is atomic when one week is invalid", async () => {
      const before = (await api("GET", `/api/weeks?roadmapId=${roadmapA}`, mentorA.token)).data.length;
      const res = await api("POST", "/api/weeks/bulk", mentorA.token, [
        { roadmapId: roadmapA, number: 20, title: "Valide", ...dates, objectives: [{ type: "OTHER", title: "O", orderIndex: 0, tasks: [{ label: "T", orderIndex: 0 }] }] },
        { roadmapId: roadmapA, number: 21, title: "Sans objectif", ...dates, objectives: [] },
      ]);
      assert.equal(res.status, 400, JSON.stringify(res.data));
      const after = (await api("GET", `/api/weeks?roadmapId=${roadmapA}`, mentorA.token)).data.length;
      assert.equal(after, before);
    });
  });

  describe("learner visibility", () => {
    test("an attached learner sees validated weeks only", async () => {
      assert.equal((await api("GET", `/api/weeks/${learnerWeek}`, learner.token)).status, 200);
      assert.equal((await api("GET", `/api/weeks/${draftWeek}`, learner.token)).status, 404);
    });
  });

  describe("two roadmaps", () => {
    test("a learner attached to roadmap A gets nothing from roadmap B", async () => {
      const wb = await api("POST", "/api/weeks", mentorB.token, { roadmapId: roadmapB, number: 1, title: "Semaine B", ...dates });
      assert.equal(wb.status, 201, JSON.stringify(wb.data));
      track(`/api/weeks/${wb.data.id}`, mentorB.token);
      assert.equal((await api("POST", `/api/weeks/${wb.data.id}/validate`, mentorB.token)).status, 200);

      assert.equal((await api("GET", `/api/weeks?roadmapId=${roadmapB}`, learner.token)).status, 404);
      assert.equal((await api("GET", `/api/weeks/${wb.data.id}`, learner.token)).status, 404);
      assert.equal((await api("GET", `/api/weeks/${wb.data.id}/comments`, learner.token)).status, 404);
      assert.equal((await api("GET", `/api/progress/summary?roadmapId=${roadmapB}`, learner.token)).status, 404);
      assert.equal((await api("GET", `/api/roadmaps/${roadmapB}`, learner.token)).status, 404);
      const own = await api("GET", `/api/weeks?roadmapId=${roadmapA}`, learner.token);
      assert.equal(own.status, 200);
      assert.ok(own.data.every((w: any) => w.roadmapId === roadmapA));
    });
  });

  describe("access matrix", () => {
    const week = () => `/api/weeks/${draftWeek}`;
    expectAccess(tokens, [
      // Learners and anonymous callers cannot edit content.
      ["POST", "/api/weeks", "learner", { roadmapId: 0, number: 99, title: "x", ...dates }, 403],
      ["POST", "/api/weeks/bulk", "learner", [], 403],
      ["PUT", week, "learner", { title: "x" }, 403],
      ["DELETE", week, "learner", undefined, 403],
      ["POST", () => `${week()}/validate`, "learner", undefined, 403],
      ["POST", () => `${week()}/clone`, "learner", { newNumber: 50 }, 403],
      ["PUT", week, "anonymous", { title: "x" }, 401],
      ["GET", week, "anonymous", undefined, 401],
      // A mentor never reaches a week of someone else's roadmap.
      ["GET", week, "mentorB", undefined, 404],
      ["PUT", week, "mentorB", { title: "x" }, 404],
      ["DELETE", week, "mentorB", undefined, 404],
      ["POST", () => `${week()}/validate`, "mentorB", undefined, 404],
      ["POST", () => `${week()}/clone`, "mentorB", { newNumber: 50 }, 404],
      // A learner without mentorship sees nothing.
      ["GET", week, "outsider", undefined, 404],
    ]);

    test("a mentor cannot create a week in another mentor's roadmap", async () => {
      const res = await api("POST", "/api/weeks", mentorB.token, { roadmapId: roadmapA, number: 77, title: "intrus", ...dates });
      assert.ok([403, 404].includes(res.status), `status ${res.status}: ${JSON.stringify(res.data)}`);
      const weeks = await api("GET", `/api/weeks?roadmapId=${roadmapA}`, mentorA.token);
      assert.ok(!weeks.data.some((w: any) => w.title === "intrus"));
    });

    test("owner still reaches own week and other roadmap stays isolated", async () => {
      assert.equal((await api("GET", week(), mentorA.token)).status, 200);
      assert.equal((await api("GET", `/api/weeks?roadmapId=${roadmapB}`, mentorA.token)).status, 404);
    });
  });
});
