import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const BASE = process.env.TEST_BASE_URL;
const PASSWORD = "Test123!";

describe("HTTP hardening", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let mentor: string;

  before(async () => {
    await fetch(`${BASE}/api/auth/create-test-users`, { method: "POST" });
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "mentor@test.com", password: PASSWORD }),
    });
    assert.equal(login.status, 200);
    mentor = (await login.json()).token;
  });

  test("public responses carry the security headers", async () => {
    const res = await fetch(`${BASE}/health/live`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  test("a JSON body above the limit is rejected with 413", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c", password: "x".repeat(2 * 1024 * 1024) }),
    });
    assert.equal(res.status, 413);
  });

  test("a scriptable image type is refused on upload", async () => {
    const res = await fetch(`${BASE}/api/objects/local-upload/hardening-${Date.now()}`, {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml", Authorization: `Bearer ${mentor}` },
      body: "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    });
    assert.ok([400, 404, 415].includes(res.status), String(res.status));
    assert.notEqual(res.status, 201);
  });

  test("AI generation rejects oversized or non-text input before any model call", async () => {
    const res = await fetch(`${BASE}/api/ai/generate-roadmap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mentor}` },
      body: JSON.stringify({ topic: "x".repeat(201), numberOfWeeks: 4 }),
    });
    assert.equal(res.status, 400);
  });
});
