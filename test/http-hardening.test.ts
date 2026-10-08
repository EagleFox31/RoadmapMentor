import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  applySecurityHeaders,
  contentSecurityPolicy,
  createLimiter,
  isAllowedUploadType,
  hasRasterImageSignature,
  resolveRateLimits,
  resolveTrustProxy,
  DEFAULT_RATE_LIMITS,
} from "../server/http/hardening";

async function withServer(setup: (app: express.Express) => void, run: (base: string) => Promise<void>) {
  const app = express();
  setup(app);
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("a limiter answers 429 once the budget is spent, then keeps counting per window", async () => {
  await withServer(
    (app) => {
      app.use(createLimiter({ windowMs: 60_000, max: 2 }));
      app.get("/", (_req, res) => res.json({ ok: true }));
    },
    async (base) => {
      assert.equal((await fetch(base)).status, 200);
      assert.equal((await fetch(base)).status, 200);
      const blocked = await fetch(base);
      assert.equal(blocked.status, 429);
      assert.deepEqual(await blocked.json(), { error: "Too many requests. Please try again later." });
    },
  );
});

test("a user-keyed limiter does not share its budget between users", async () => {
  await withServer(
    (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: Number(req.headers["x-user"]) };
        next();
      });
      app.use(createLimiter({ windowMs: 60_000, max: 1 }, true));
      app.get("/", (_req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const call = (user: string) => fetch(base, { headers: { "x-user": user } }).then((r) => r.status);
      assert.equal(await call("1"), 200);
      assert.equal(await call("1"), 429);
      assert.equal(await call("2"), 200);
    },
  );
});

test("security headers are present on public responses", async () => {
  await withServer(
    (app) => {
      applySecurityHeaders(app, { NODE_ENV: "production" } as NodeJS.ProcessEnv);
      app.get("/", (_req, res) => res.send("ok"));
    },
    async (base) => {
      const res = await fetch(base);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
      assert.ok(res.headers.get("strict-transport-security"));
      assert.equal(res.headers.get("x-powered-by"), null);
      const csp = res.headers.get("content-security-policy") ?? "";
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.doesNotMatch(csp, /script-src[^;]*'unsafe-(inline|eval)'/);
      assert.match(csp, /worker-src/);
    },
  );
});

test("the CSP is not applied in development so the dev server keeps working", async () => {
  await withServer(
    (app) => {
      applySecurityHeaders(app, { NODE_ENV: "development" } as NodeJS.ProcessEnv);
      app.get("/", (_req, res) => res.send("ok"));
    },
    async (base) => {
      const res = await fetch(base);
      assert.equal(res.headers.get("content-security-policy"), null);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    },
  );
});

test("the CSP allows the fonts and signed uploads the frontend needs", () => {
  const { directives } = contentSecurityPolicy();
  assert.ok(directives["style-src"].includes("https://fonts.googleapis.com"));
  assert.ok(directives["font-src"].includes("https://fonts.gstatic.com"));
  assert.ok(directives["connect-src"].includes("https://storage.googleapis.com"));
  assert.ok(directives["script-src"].includes("https://cdn.jsdelivr.net"));
  assert.ok(directives["connect-src"].includes("https://cdn.jsdelivr.net"));
  assert.ok(directives["worker-src"].includes("'self'"));
  assert.ok(directives["script-src"].includes("'wasm-unsafe-eval'"));
});

test("only raster image types are accepted for uploads", () => {
  for (const ok of ["image/png", "image/jpeg", "image/webp", "image/gif", "IMAGE/PNG; charset=binary"]) {
    assert.equal(isAllowedUploadType(ok), true, ok);
  }
  for (const bad of ["image/svg+xml", "text/html", "application/pdf", "", undefined]) {
    assert.equal(isAllowedUploadType(bad), false, String(bad));
  }
});

test("image uploads must match their claimed MIME signature", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(7)]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const webp = Buffer.concat([
    Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8),
  ]);
  assert.equal(hasRasterImageSignature("image/png", png), true);
  assert.equal(hasRasterImageSignature("IMAGE/PNG; charset=binary", png), true);
  assert.equal(hasRasterImageSignature("image/jpeg", jpeg), true);
  assert.equal(hasRasterImageSignature("image/gif", gif), true);
  assert.equal(hasRasterImageSignature("image/webp", webp), true);
  assert.equal(hasRasterImageSignature("image/jpeg", png), false);
  assert.equal(hasRasterImageSignature("image/png", Buffer.from("<svg><script>alert(1)</script></svg>")), false);
  assert.equal(hasRasterImageSignature("image/png", Buffer.from("not-a-png")), false);
  assert.equal(hasRasterImageSignature("image/gif", Buffer.alloc(0)), false);
  assert.equal(hasRasterImageSignature("image/svg+xml", Buffer.from("<svg/>")), false);
});

test("rate limits default safely and accept valid overrides only", () => {
  assert.deepEqual(resolveRateLimits({} as NodeJS.ProcessEnv), DEFAULT_RATE_LIMITS);
  const custom = resolveRateLimits({
    RATE_LIMIT_AUTH_MAX: "500",
    RATE_LIMIT_AI_MAX: "-3",
    RATE_LIMIT_JOBS_WINDOW_MS: "abc",
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(custom.auth.max, 500);
  assert.equal(custom.ai.max, DEFAULT_RATE_LIMITS.ai.max);
  assert.equal(custom.jobs.windowMs, DEFAULT_RATE_LIMITS.jobs.windowMs);
  assert.equal(custom.invitation.max, DEFAULT_RATE_LIMITS.invitation.max);
});

test("trust proxy is off unless explicitly configured", () => {
  assert.equal(resolveTrustProxy({} as NodeJS.ProcessEnv), false);
  assert.equal(resolveTrustProxy({ TRUST_PROXY: "1" } as unknown as NodeJS.ProcessEnv), 1);
  assert.equal(resolveTrustProxy({ TRUST_PROXY: "yes" } as unknown as NodeJS.ProcessEnv), false);
});
