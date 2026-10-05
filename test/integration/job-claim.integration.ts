import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

// Needs DATABASE_URL (disposable database); enabled together with the other integration tests.
const enabled = !!process.env.TEST_BASE_URL && !!process.env.DATABASE_URL;

describe("scheduled job claims", { skip: !enabled && "TEST_BASE_URL/DATABASE_URL not set" }, () => {
  after(async () => {
    const { pool } = await import("../../server/db");
    await pool.end();
  });

  test("only one of many concurrent instances claims a slot, and a replay is refused", async () => {
    const { claimJobRun, finishJobRun } = await import("../../server/services/jobRuns");
    const job = `it-job-${Date.now().toString(36)}`;
    const slot = "2026-10-07T08:00:00.000Z";

    const results = await Promise.all(Array.from({ length: 6 }, () => claimJobRun(job, slot)));
    assert.equal(results.filter(Boolean).length, 1);

    await finishJobRun(job, slot, "SUCCEEDED", "ok");
    assert.equal(await claimJobRun(job, slot), false, "a processed slot is not replayed");
    assert.equal(await claimJobRun(job, "2026-10-09T08:00:00.000Z"), true, "the next slot is independent");
  });
});
