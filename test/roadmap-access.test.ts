import test from "node:test";
import assert from "node:assert/strict";
import { hasRoadmapAccess } from "../server/domain/roadmapAccess";

const roadmapOne = {
  id: 1,
  createdByUserId: 10,
  isLegacy: false,
};

const roadmapTwo = {
  id: 2,
  createdByUserId: 20,
  isLegacy: false,
};

const memberships = [
  {
    roadmapId: 1,
    mentorId: 10,
    learnerId: 101,
    status: "ACTIVE" as const,
  },
  {
    roadmapId: 2,
    mentorId: 20,
    learnerId: 202,
    status: "ACTIVE" as const,
  },
];

test("learners cannot access another learner's roadmap", () => {
  assert.equal(
    hasRoadmapAccess({
      userId: 101,
      role: "LEARNER",
      roadmap: roadmapOne,
      memberships,
    }),
    true,
  );

  assert.equal(
    hasRoadmapAccess({
      userId: 101,
      role: "LEARNER",
      roadmap: roadmapTwo,
      memberships,
    }),
    false,
  );
});

test("mentors cannot manage an unrelated non-legacy roadmap", () => {
  assert.equal(
    hasRoadmapAccess({
      userId: 10,
      role: "MENTOR",
      roadmap: roadmapOne,
      memberships,
    }),
    true,
  );

  assert.equal(
    hasRoadmapAccess({
      userId: 10,
      role: "MENTOR",
      roadmap: roadmapTwo,
      memberships,
    }),
    false,
  );
});

test("cancelled mentorships revoke learner access", () => {
  assert.equal(
    hasRoadmapAccess({
      userId: 101,
      role: "LEARNER",
      roadmap: roadmapOne,
      memberships: [
        {
          roadmapId: 1,
          mentorId: 10,
          learnerId: 101,
          status: "CANCELLED",
        },
      ],
    }),
    false,
  );
});

test("legacy roadmaps preserve mentor access during migration", () => {
  assert.equal(
    hasRoadmapAccess({
      userId: 999,
      role: "MENTOR",
      roadmap: {
        id: 3,
        createdByUserId: 10,
        isLegacy: true,
      },
      memberships: [],
    }),
    true,
  );
});

test("legacy roadmaps do not grant learners implicit access", () => {
  assert.equal(
    hasRoadmapAccess({
      userId: 101,
      role: "LEARNER",
      roadmap: {
        id: 3,
        createdByUserId: 10,
        isLegacy: true,
      },
      memberships: [],
    }),
    false,
  );
});
