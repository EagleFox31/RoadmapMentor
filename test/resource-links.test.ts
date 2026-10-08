import test from "node:test";
import assert from "node:assert/strict";
import { safeExternalResourceUrl, supportedVideoEmbed } from "../shared/resourceLinks";
import { insertResourceSchema } from "../shared/schema";

const videoId = "dQw4w9WgXcQ";

test("YouTube URLs normalize to the privacy-enhanced player", () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${videoId}&list=anything`,
    `https://m.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}?t=30`,
    `https://www.youtube.com/shorts/${videoId}`,
    `https://www.youtube.com/live/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`,
  ]) {
    assert.deepEqual(supportedVideoEmbed(url), {
      provider: "YouTube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
    }, url);
  }
});

test("Vimeo URLs normalize to the official player", () => {
  for (const url of ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"]) {
    assert.deepEqual(supportedVideoEmbed(url), {
      provider: "Vimeo", embedUrl: "https://player.vimeo.com/video/123456789",
    });
  }
});

test("unsupported, unsafe, deceptive or malformed URLs never enter an iframe", () => {
  for (const url of [
    "https://www.youtube.com.evil.org/watch?v=" + videoId,
    "https://vimeo.com.attacker.test/123456789",
    "https://www.youtube.com@evil.test/watch?v=" + videoId,
    "https://youtube.com/watch?v=wrong",
    "https://youtu.be/not-valid",
    "https://vimeo.com/not-a-video",
    "https://vimeo.com/channels/staffpicks/123456789",
    "http://www.youtube.com/watch?v=" + videoId,
    "https://www.youtube.com:8443/watch?v=" + videoId,
    "https://www.example.com/video/" + videoId,
    "javascript:alert(1)",
    "data:text/html,<iframe>",
    "/relative-path",
    "",
  ]) assert.equal(supportedVideoEmbed(url), null, url);
});

test("only credential-free HTTP(S) resource links are ever clickable", () => {
  assert.equal(safeExternalResourceUrl("https://fastapi.tiangolo.com/"), "https://fastapi.tiangolo.com/");
  assert.equal(safeExternalResourceUrl("http://docs.example.org/"), "http://docs.example.org/");
  for (const invalid of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "/relative", "", "https://admin:secret@example.org/"]) {
    assert.equal(safeExternalResourceUrl(invalid), null, invalid);
  }
});

test("andragogical context is validated, and stays optional for legacy resources", () => {
  const base = { weekId: 1, label: "Git", resourceType: "DOC", url: "https://example.org/git" };
  const legacy = insertResourceSchema.safeParse(base);
  assert.equal(legacy.success, true);
  if (legacy.success) {
    assert.equal(legacy.data.isRequired, false);
    assert.equal(legacy.data.orderIndex, 0);
  }
  assert.equal(insertResourceSchema.safeParse({
    ...base, problemToSolve: "What caused this deployment failure?",
    practicePrompt: "Reproduce it, correct it and document the fix.",
    estimatedMinutes: 15, isRequired: true, orderIndex: 3,
  }).success, true);
  for (const bad of [
    { estimatedMinutes: 0 }, { estimatedMinutes: 481 },
    { orderIndex: -1 }, { isRequired: "yes" },
    { practicePrompt: "x".repeat(1201) },
  ]) assert.equal(insertResourceSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad));
});

test("resource creation schema rejects scriptable and credential-bearing links", () => {
  const base = { weekId: 1, label: "Ressource", resourceType: "VIDEO" };
  assert.equal(insertResourceSchema.safeParse({ ...base, url: "https://youtu.be/" + videoId }).success, true);
  assert.equal(insertResourceSchema.safeParse({ ...base, url: "https://example.org/video" }).success, true);
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "https://u:p@youtube.com/watch?v=" + videoId]) {
    assert.equal(insertResourceSchema.safeParse({ ...base, url }).success, false, url);
  }
});
