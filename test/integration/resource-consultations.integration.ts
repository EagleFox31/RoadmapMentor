import assert from "node:assert/strict";
import { test } from "node:test";
import { api, BASE, mentoringFixture } from "./support/api";

test("consultation is learner-scoped and separate from task progress", { skip: !BASE && "TEST_BASE_URL not set" }, async () => {
  const { mentorA, mentorB, learner, outsider, roadmapId } = await mentoringFixture("rm019-consult");
  const w = await api("POST", "/api/weeks", mentorA.token, {
    roadmapId, number: 1, title: "Problem based exercise",
    startDate: "2026-10-05", endDate: "2026-10-11",
  });
  assert.equal(w.status, 201);
  const resource = await api("POST", `/api/weeks/${w.data.id}/resources`, mentorA.token, {
    label: "Read and experiment", url: "https://example.org/guide.pdf", resourceType: "DOC",
  });
  assert.equal(resource.status, 201);
  assert.equal(resource.data.isApproved, true);
  assert.equal((await api("POST", `/api/weeks/${w.data.id}/validate`, mentorA.token)).status, 200);

  const list = `/api/weeks/${w.data.id}/resource-consultations`;
  const action = `/api/resources/${resource.data.id}/consultation`;
  const before = await api("GET", `/api/progress/summary?roadmapId=${roadmapId}`, learner.token);
  assert.equal((await api("GET", list, mentorA.token)).status, 403);
  assert.equal((await api("GET", list, outsider.token)).status, 404);
  assert.equal((await api("PUT", action, mentorA.token, { consulted: true })).status, 403);
  assert.equal((await api("PUT", action, outsider.token, { consulted: true })).status, 404);
  assert.equal((await api("PUT", action, learner.token, { consulted: "yes" })).status, 400);

  for (let i = 0; i < 2; i++) assert.equal((await api("PUT", action, learner.token, { consulted: true })).status, 200);
  assert.deepEqual((await api("GET", list, learner.token)).data.resourceIds, [resource.data.id]);
  const after = await api("GET", `/api/progress/summary?roadmapId=${roadmapId}`, learner.token);
  assert.deepEqual(after.data, before.data);
  assert.equal((await api("PUT", action, learner.token, { consulted: false })).status, 200);
  assert.deepEqual((await api("GET", list, learner.token)).data.resourceIds, []);

  const report = `/api/resources/${resource.data.id}/report-unavailable`;
  assert.equal((await api("POST", report, outsider.token, {})).status, 404);
  assert.equal((await api("POST", report, learner.token, {})).status, 200);
  const mentorWeeks = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, mentorA.token);
  assert.ok(mentorWeeks.data[0].resources[0].unavailableReportedAt);
  assert.equal((await api("POST", `/api/resources/${resource.data.id}/clear-unavailable`, mentorB.token, {})).status, 404);
  assert.equal((await api("POST", `/api/resources/${resource.data.id}/clear-unavailable`, mentorA.token, {})).status, 200);
  const updated = await api("PUT", `/api/resources/${resource.data.id}`, mentorA.token, { url: "https://example.org/changed.pdf" });
  assert.equal(updated.data.isApproved, false);
  assert.equal(updated.data.unavailableReportedAt, null);
  assert.equal((await api("PUT", action, learner.token, { consulted: true })).status, 404);
  assert.equal((await api("POST", `/api/resources/${resource.data.id}/approve`, learner.token, {})).status, 403);
  assert.equal((await api("POST", `/api/resources/${resource.data.id}/approve`, mentorB.token, {})).status, 404);
  assert.equal((await api("POST", `/api/resources/${resource.data.id}/approve`, mentorA.token, {})).status, 200);
});
