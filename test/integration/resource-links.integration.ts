import assert from "node:assert/strict";
import { test } from "node:test";
import { api, BASE, mentoringFixture } from "./support/api";

test("mentor can create safe resource links but cannot store scriptable URLs", { skip: !BASE && "TEST_BASE_URL not set" }, async () => {
  const { mentorA, learner, roadmapId } = await mentoringFixture("resource-links");
  const w = await api("POST", "/api/weeks", mentorA.token, {
    roadmapId, number: 1, title: "Video resources",
    startDate: "2026-10-05", endDate: "2026-10-11",
  });
  assert.equal(w.status, 201, JSON.stringify(w.data));
  const route = `/api/weeks/${w.data.id}/resources`;
  for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "https://name:password@vimeo.com/123456789"]) {
    const invalid = await api("POST", route, mentorA.token, { label: "Unsafe link", url, resourceType: "VIDEO" });
    assert.equal(invalid.status, 400, JSON.stringify(invalid.data));
  }

  const video = await api("POST", route, mentorA.token, {
    label: "Leçon vidéo", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    resourceType: "VIDEO",
  });
  assert.equal(video.status, 201, JSON.stringify(video.data));

  const vimeo = await api("PUT", `/api/resources/${video.data.id}`, mentorA.token, {
    url: "https://vimeo.com/123456789",
  });
  assert.equal(vimeo.status, 200, JSON.stringify(vimeo.data));
  assert.equal(vimeo.data.url, "https://vimeo.com/123456789");

  const badUpdate = await api("PUT", `/api/resources/${video.data.id}`, mentorA.token, {
    url: "javascript:alert(document.domain)",
  });
  assert.equal(badUpdate.status, 400);

  const learnerAttempt = await api("POST", route, learner.token, {
    label: "Role elevation", url: "https://vimeo.com/123456789", resourceType: "VIDEO",
  });
  assert.equal(learnerAttempt.status, 403);
});
