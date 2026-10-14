import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { APP_BUILD_HEADER, isStaleBuild, readAppBuildId } from "../shared/appBuild";
import { appBuildHeader, registerAppBuildRoute, registerServedBuild, servedBuild } from "../server/http/appBuild";

const html = (id: string) => `<!doctype html><html><head><meta charset="UTF-8" />\n    <meta name="app-build" content="${id}">\n</head></html>`;

test("the build id is read from the meta tag injected at build time", () => {
  assert.equal(readAppBuildId(html("mgq2x1-9f3a01bc")), "mgq2x1-9f3a01bc");
  assert.equal(readAppBuildId("<html><head></head></html>"), null);
  assert.equal(readAppBuildId(html("a b<script>")), null);
  assert.equal(readAppBuildId(html("")), null);
});

test("a tab is stale only when both builds are known and differ", () => {
  assert.equal(isStaleBuild("a1", "b2"), true);
  assert.equal(isStaleBuild("a1", "a1"), false);
  assert.equal(isStaleBuild(null, "b2"), false, "dev client: no build id, never reload");
  assert.equal(isStaleBuild("a1", null), false, "older server without the header");
  assert.equal(isStaleBuild("a1", "bad value!"), false);
});

test("every /api response carries the served build, and the probe needs no session", async () => {
  assert.equal(registerServedBuild(html("build-42")), "build-42");
  const app = express();
  app.use("/api", appBuildHeader);
  registerAppBuildRoute(app);
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const probe = await fetch(`${base}/api/app-build`);
    assert.equal(probe.status, 204);
    assert.equal(probe.headers.get(APP_BUILD_HEADER), "build-42");
    assert.equal(probe.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(`${base}/api/ping`)).headers.get(APP_BUILD_HEADER), "build-42");
  } finally {
    server.close();
    registerServedBuild("");
  }
  assert.equal(servedBuild(), null, "dev server (no built index.html) sends no header");
});
