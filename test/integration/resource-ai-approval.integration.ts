import assert from "node:assert/strict";
import { test } from "node:test";
import { api, BASE, mentoringFixture } from "./support/api";

test("bulk AI links stay hidden until explicitly approved by the scoped mentor", { skip: !BASE && "TEST_BASE_URL not set" }, async () => {
  const { mentorA, mentorB, learner, outsider, roadmapId } = await mentoringFixture("rm019-ai");
  const imported = await api("POST", "/api/weeks/bulk", mentorA.token, [{
    roadmapId, number: 1, title: "Imported AI research",
    startDate: "2026-10-05", endDate: "2026-10-11",
    objectives: [{ type: "PROJECT", title: "Deliver a working fix", orderIndex: 0,
      tasks: [{ label: "Diagnose and correct", orderIndex: 0 }] }],
    resources: [{ label: "Unverified AI suggestion", url: "https://vimeo.com/123456789",
      resourceType: "VIDEO" }],
  }]);
  assert.equal(imported.status, 201, JSON.stringify(imported.data));
  const w = imported.data.weeks[0].id;
  const resourceId = imported.data.weeks[0].resources[0].id;
  assert.equal((await api("POST", `/api/weeks/${w}/validate`, mentorA.token)).status, 200);

  let mentorView = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, mentorA.token);
  assert.equal(mentorView.data.find((x: any) => x.id === w).resources[0].isApproved, false);
  let learnerView = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, learner.token);
  assert.deepEqual(learnerView.data.find((x: any) => x.id === w).resources, []);
  assert.equal((await api("POST", `/api/resources/${resourceId}/approve`, mentorB.token, {})).status, 404);
  assert.equal((await api("POST", `/api/resources/${resourceId}/approve`, outsider.token, {})).status, 403);
  assert.equal((await api("PUT", `/api/resources/${resourceId}/consultation`, learner.token, { consulted: true })).status, 404);
  assert.equal((await api("POST", `/api/resources/${resourceId}/approve`, mentorA.token, {})).status, 200);

  learnerView = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, learner.token);
  assert.equal(learnerView.data.find((x: any) => x.id === w).resources[0].id, resourceId);
  assert.equal((await api("PUT", `/api/resources/${resourceId}/consultation`, learner.token, { consulted: true })).status, 200);
});
