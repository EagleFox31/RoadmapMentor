import assert from "node:assert/strict";
import { test } from "node:test";
import { api, BASE, mentoringFixture } from "./support/api";

test("proof images remain private and mentors can view only their learners' evidence", { skip: !BASE && "TEST_BASE_URL not set" }, async () => {
  const { mentorA, mentorB, learner, outsider, roadmapId } = await mentoringFixture("proof-privacy");
  const week = await api("POST", "/api/weeks", mentorA.token, {
    roadmapId, number: 1, title: "Preuves privées",
    startDate: "2026-10-05", endDate: "2026-10-11",
  });
  assert.equal(week.status, 201, JSON.stringify(week.data));
  const objective = await api("POST", `/api/weeks/${week.data.id}/objectives`, mentorA.token, {
    title: "Upload", type: "OTHER",
  });
  assert.equal(objective.status, 201, JSON.stringify(objective.data));
  const task = await api("POST", `/api/objectives/${objective.data.id}/tasks`, mentorA.token, { label: "Proof" });
  assert.equal(task.status, 201, JSON.stringify(task.data));
  const validated = await api("POST", `/api/weeks/${week.data.id}/validate`, mentorA.token);
  assert.equal(validated.status, 200, JSON.stringify(validated.data));

  const target = await api("POST", "/api/objects/upload", learner.token, {});
  assert.equal(target.status, 200, JSON.stringify(target.data));
  const { objectPath, uploadURL, uploadTicket } = target.data;
  const data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const saved = await fetch(BASE + uploadURL, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png", Authorization: `Bearer ${learner.token}`,
      "X-Upload-Ticket": uploadTicket,
    },
    body: data,
  });
  assert.equal(saved.status, 201, await saved.text());

  // The API must refuse external URLs masquerading as evidence.
  const forged = await api("POST", `/api/tasks/${task.data.id}/toggle-progress`, learner.token, {
    screenshotUrl: "https://example.org/fake.png",
  });
  assert.equal(forged.status, 400);

  const progress = await api("POST", `/api/tasks/${task.data.id}/toggle-progress`, learner.token, { screenshotUrl: objectPath });
  assert.equal(progress.status, 200, JSON.stringify(progress.data));
  assert.equal(progress.data.isDone, true);

  const get = async (path: string, token?: string) =>
    fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const evidence = `/api/tasks/${task.data.id}/evidence/${learner.id}`;
  assert.equal((await get(objectPath)).status, 401, "anonymous must never see proof");
  assert.equal((await get(objectPath, outsider.token)).status, 403);
  assert.equal((await get(objectPath, mentorA.token)).status, 403, "mentor must use scoped route");
  const ownerFile = await get(objectPath, learner.token);
  assert.equal(ownerFile.status, 200);
  assert.match(ownerFile.headers.get("cache-control") ?? "", /private, no-store/);
  assert.equal((await get(evidence)).status, 401);
  assert.equal((await get(evidence, outsider.token)).status, 404);
  assert.equal((await get(evidence, mentorB.token)).status, 404);
  assert.equal((await get(`/api/tasks/${task.data.id}/evidence/${outsider.id}`, learner.token)).status, 403);

  for (const token of [learner.token, mentorA.token]) {
    const response = await get(evidence, token);
    assert.equal(response.status, 200);
    assert.equal(Buffer.from(await response.arrayBuffer()).toString("base64"), data.toString("base64"));
    assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  }
});
