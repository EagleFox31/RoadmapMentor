import test from "node:test";
import assert from "node:assert/strict";
import { publicRegistrationSchema } from "../shared/schema";
import {
  isDevelopmentEnvironment,
  resolveJwtSecret,
} from "../server/security";

test("public registration accepts learner account fields without a role", () => {
  const parsed = publicRegistrationSchema.parse({
    fullName: "Pavel Learner",
    email: "pavel@example.com",
    password: "strong-password",
  });

  assert.equal(parsed.fullName, "Pavel Learner");
  assert.equal("role" in parsed, false);
});

test("public registration rejects caller-supplied roles", () => {
  assert.throws(() =>
    publicRegistrationSchema.parse({
      fullName: "Malicious Mentor",
      email: "mentor@example.com",
      password: "strong-password",
      role: "MENTOR",
    }),
  );
});

test("JWT secret is mandatory in production", () => {
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: undefined }),
    /JWT_SECRET is required/,
  );
});

test("JWT secret is mandatory in test and other non-development environments", () => {
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: "test", JWT_SECRET: undefined }),
    /JWT_SECRET is required/,
  );
});

test("local development can use the development-only fallback", () => {
  const secret = resolveJwtSecret({
    NODE_ENV: "development",
    JWT_SECRET: undefined,
  });

  assert.equal(isDevelopmentEnvironment({ NODE_ENV: "development" }), true);
  assert.match(secret, /development-only/);
});

test("configured JWT secret always wins", () => {
  assert.equal(
    resolveJwtSecret({
      NODE_ENV: "production",
      JWT_SECRET: "configured-production-secret",
    }),
    "configured-production-secret",
  );
});
