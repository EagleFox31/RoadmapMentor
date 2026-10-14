import assert from "node:assert/strict";
import { test } from "node:test";
import { daysUntilEndDate } from "../server/services/weekDeadlines";

test("daysUntilEndDate counts calendar days in Europe/Paris", () => {
  const wednesday = new Date("2026-10-14T12:00:00+02:00");
  assert.equal(daysUntilEndDate("2026-10-16", wednesday), 2);
  assert.equal(daysUntilEndDate("2026-10-14", wednesday), 0);
  assert.equal(daysUntilEndDate("2026-10-13", wednesday), -1);
  assert.equal(daysUntilEndDate("not-a-date", wednesday), null);
});
