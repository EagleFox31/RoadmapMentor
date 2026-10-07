import test from "node:test";
import assert from "node:assert/strict";
import { handleError } from "../server/http/errors";
import {
  ConflictError,
  GoneError,
  InvalidRequestError,
  NotFoundError,
} from "../server/domain/errors";
import { assertCurrencyMatches } from "../server/domain/billing";
import { assertChangeRequestTransition } from "../server/domain/changeRequest";

function run(error: unknown) {
  let status = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    handleError(res, error);
  } finally {
    console.error = originalError;
  }
  return { status, body };
}

test("business errors map to their HTTP status with the same body shape", () => {
  assert.deepEqual(run(new NotFoundError("Roadmap not found")), {
    status: 404,
    body: { error: "Roadmap not found" },
  });
  assert.deepEqual(run(new InvalidRequestError("roadmapId must be a positive integer")), {
    status: 400,
    body: { error: "roadmapId must be a positive integer" },
  });
  assert.deepEqual(run(new ConflictError("boom")), {
    status: 409,
    body: { error: "boom" },
  });
  assert.deepEqual(run(new GoneError("Invitation expired", "EXPIRED")), {
    status: 410,
    body: { error: "Invitation expired", reason: "EXPIRED" },
  });
});

test("validation and unexpected errors keep their mapping", () => {
  const zod = Object.assign(new Error("z"), { name: "ZodError", issues: [1] });
  assert.deepEqual(run(zod), {
    status: 400,
    body: { error: "Validation failed", issues: [1] },
  });
  assert.equal(run(new Error("db down")).status, 500);
});

test("domain rules raise conflict errors", () => {
  assert.throws(() => assertCurrencyMatches("EUR", "USD"), ConflictError);
  assert.throws(
    () => assertChangeRequestTransition("DELIVERED" as any, "REQUESTED" as any),
    ConflictError,
  );
});
