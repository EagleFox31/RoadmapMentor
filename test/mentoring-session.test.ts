import test from "node:test";
import assert from "node:assert/strict";
import {
  completeMentoringSessionSchema,
  scheduleMentoringSessionSchema,
} from "../shared/schema";
import {
  canFinalizeMentoringSession,
  finalStatusForAttendance,
} from "../server/domain/mentoringSession";

test("included weekend session requires a package", () => {
  assert.throws(() =>
    scheduleMentoringSessionSchema.parse({
      title: "ShopFlow weekend session",
      startsAt: "2026-10-10T16:00:00+01:00",
      endsAt: "2026-10-10T19:00:00+01:00",
      isAdditional: false,
    }),
  );

  const parsed = scheduleMentoringSessionSchema.parse({
    packageId: 10,
    weekId: 4,
    title: "ShopFlow weekend session",
    startsAt: "2026-10-10T16:00:00+01:00",
    endsAt: "2026-10-10T19:00:00+01:00",
    isAdditional: false,
  });

  assert.equal(parsed.packageId, 10);
  assert.equal(parsed.isAdditional, false);
});

test("additional session can exist outside the included package count", () => {
  const parsed = scheduleMentoringSessionSchema.parse({
    title: "Additional code review",
    startsAt: "2026-10-14T18:00:00+01:00",
    endsAt: "2026-10-14T19:00:00+01:00",
    isAdditional: true,
    additionalPriceMinor: 10000,
    additionalPriceCurrency: "XAF",
  });

  assert.equal(parsed.isAdditional, true);
});

test("session end must be after start", () => {
  assert.throws(() =>
    scheduleMentoringSessionSchema.parse({
      packageId: 1,
      title: "Invalid session",
      startsAt: "2026-10-10T19:00:00+01:00",
      endsAt: "2026-10-10T16:00:00+01:00",
      isAdditional: false,
    }),
  );
});

test("only scheduled sessions can be finalized", () => {
  assert.equal(canFinalizeMentoringSession("SCHEDULED"), true);
  assert.equal(canFinalizeMentoringSession("COMPLETED"), false);
  assert.equal(canFinalizeMentoringSession("CANCELLED"), false);
  assert.equal(canFinalizeMentoringSession("NO_SHOW"), false);
});

test("attendance determines completed versus no-show", () => {
  assert.equal(finalStatusForAttendance(true), "COMPLETED");
  assert.equal(finalStatusForAttendance(false), "NO_SHOW");
});

test("mentor completion payload records attendance and optional notes", () => {
  const parsed = completeMentoringSessionSchema.parse({
    learnerAttended: true,
    mentorNotes: "PCAP review and Git branch exercise completed.",
  });

  assert.equal(parsed.learnerAttended, true);
  assert.match(parsed.mentorNotes || "", /PCAP/);
});
