import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completionPercentage,
  crossedMilestones,
} from "../server/services/milestones";

test("completionPercentage rounds a ratio to a percent", () => {
  assert.equal(completionPercentage(0, 0), 0);
  assert.equal(completionPercentage(1, 4), 25);
  assert.equal(completionPercentage(2, 3), 67);
});

test("crossedMilestones reports only newly reached 25/50/75/100", () => {
  assert.deepEqual(crossedMilestones(0, 20), []);
  assert.deepEqual(crossedMilestones(20, 25), [25]);
  assert.deepEqual(crossedMilestones(24, 80), [25, 50, 75]);
  assert.deepEqual(crossedMilestones(75, 100), [100]);
  assert.deepEqual(crossedMilestones(50, 50), []);
});
