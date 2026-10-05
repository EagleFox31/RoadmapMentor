import test from "node:test";
import assert from "node:assert/strict";
import { planUserStatus } from "../server/domain/userStatus";

test("planUserStatus reports an unknown user", () => {
  assert.equal(planUserStatus("disable", undefined), "not_found");
});

test("planUserStatus is idempotent", () => {
  assert.equal(planUserStatus("disable", { disabledAt: new Date() }), "noop");
  assert.equal(planUserStatus("enable", { disabledAt: null }), "noop");
});

test("planUserStatus applies a real transition", () => {
  assert.equal(planUserStatus("disable", { disabledAt: null }), "apply");
  assert.equal(planUserStatus("enable", { disabledAt: new Date() }), "apply");
});
