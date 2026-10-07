import test from "node:test";
import assert from "node:assert/strict";
import { handleError } from "../server/http/errors";
import { accessLog, requestId, requestIdOf } from "../server/http/observability";

function fakeRes(headers: Record<string, string> = {}) {
  const listeners: Record<string, () => void> = {};
  return {
    locals: {} as Record<string, unknown>,
    headers,
    statusCode: 200,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    on(e: string, fn: () => void) { listeners[e] = fn; },
    emit(e: string) { listeners[e]?.(); },
  };
}

function captureLogs(fn: () => void) {
  const lines: string[] = [];
  const o = { log: console.log, error: console.error };
  console.log = (l: string) => lines.push(l);
  console.error = (l: string) => lines.push(l);
  try { fn(); } finally { console.log = o.log; console.error = o.error; }
  return lines.map((l) => JSON.parse(l));
}

test("requestId reuses a safe incoming id and replaces an unsafe one", () => {
  const ok = fakeRes();
  requestId({ header: () => "trace-abc12345" } as any, ok as any, () => {});
  assert.equal(requestIdOf(ok), "trace-abc12345");
  assert.equal(ok.headers["x-request-id"], "trace-abc12345");

  const bad = fakeRes();
  requestId({ header: () => "x\ninjected log line" } as any, bad as any, () => {});
  assert.match(requestIdOf(bad)!, /^[0-9a-f-]{36}$/);
});

test("access log never contains the raw path, query or body", () => {
  const res = fakeRes();
  res.locals.requestId = "rid-12345678";
  res.statusCode = 410;
  const req = {
    method: "GET",
    originalUrl: "/api/invitations/SECRET-TOKEN?x=1",
    baseUrl: "/api/invitations",
    route: { path: "/:token" },
    user: { id: 7, role: "LEARNER" },
  };
  const [entry] = captureLogs(() => {
    accessLog(req as any, res as any, () => {});
    res.emit("finish");
  });
  assert.equal(entry.event, "http_request");
  assert.equal(entry.level, "warn");
  assert.equal(entry.route, "/api/invitations/:token");
  assert.equal(entry.requestId, "rid-12345678");
  assert.equal(entry.userId, 7);
  assert.equal(JSON.stringify(entry).includes("SECRET-TOKEN"), false);
});

test("a 500 carries the request id in the body and the log", () => {
  let body: any;
  const res: any = { locals: { requestId: "rid-12345678" }, status() { return this; }, json(p: unknown) { body = p; return this; } };
  const [entry] = captureLogs(() => handleError(res, new Error("boom")));
  assert.equal(body.requestId, "rid-12345678");
  assert.equal(entry.requestId, "rid-12345678");
  assert.equal(entry.event, "api_error");
});
