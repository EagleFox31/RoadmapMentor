import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../server/auth";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "roadmapmentor-test-secret";

const {
  authMiddleware,
  comparePassword,
  hashPassword,
  requireLearner,
  requireMentor,
} = await import("../server/auth");

function createResponse() {
  const state: { statusCode?: number; body?: unknown } = {};

  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  } as unknown as Response;

  return { response, state };
}

test("requireMentor allows mentors", () => {
  const req = { user: { role: "MENTOR" } } as AuthRequest;
  const { response, state } = createResponse();
  let nextCalled = false;

  requireMentor(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(state.statusCode, undefined);
});

test("requireMentor rejects learners", () => {
  const req = { user: { role: "LEARNER" } } as AuthRequest;
  const { response, state } = createResponse();
  let nextCalled = false;

  requireMentor(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, { error: "Mentor access required" });
});

test("requireLearner rejects mentors", () => {
  const req = { user: { role: "MENTOR" } } as AuthRequest;
  const { response, state } = createResponse();
  let nextCalled = false;

  requireLearner(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, { error: "Learner access required" });
});

test("authMiddleware rejects a request without a bearer token", () => {
  const req = { headers: {} } as AuthRequest;
  const { response, state } = createResponse();
  let nextCalled = false;

  authMiddleware(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 401);
  assert.deepEqual(state.body, { error: "No token provided" });
});

test("authMiddleware rejects an invalid bearer token", () => {
  const req = {
    headers: { authorization: "Bearer not-a-valid-token" },
  } as AuthRequest;
  const { response, state } = createResponse();
  let nextCalled = false;

  authMiddleware(req, response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 401);
  assert.deepEqual(state.body, { error: "Invalid token" });
});

test("password hashes verify the original value and reject a different value", async () => {
  const hash = await hashPassword("RoadmapMentor-test-password");

  assert.notEqual(hash, "RoadmapMentor-test-password");
  assert.equal(await comparePassword("RoadmapMentor-test-password", hash), true);
  assert.equal(await comparePassword("different-password", hash), false);
});
