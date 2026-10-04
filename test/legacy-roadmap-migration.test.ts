import test from "node:test";
import assert from "node:assert/strict";
import { buildLegacyMentorshipPairs } from "../server/domain/legacyRoadmapMigration";

test("legacy migration preserves the previous global mentor/learner visibility", () => {
  assert.deepEqual(
    buildLegacyMentorshipPairs([2, 1], [20, 10]),
    [
      { mentorId: 1, learnerId: 10 },
      { mentorId: 1, learnerId: 20 },
      { mentorId: 2, learnerId: 10 },
      { mentorId: 2, learnerId: 20 },
    ],
  );
});

test("legacy migration de-duplicates user ids before creating pairs", () => {
  assert.deepEqual(
    buildLegacyMentorshipPairs([1, 1], [10, 10]),
    [{ mentorId: 1, learnerId: 10 }],
  );
});

test("legacy migration creates no memberships when there are no learners", () => {
  assert.deepEqual(buildLegacyMentorshipPairs([1], []), []);
});
