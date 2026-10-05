import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveSchedulerConfig } from "../server/services/schedulerConfig";

describe("resolveSchedulerConfig", () => {
  test("keeps the historical schedule by default", () => {
    const config = resolveSchedulerConfig({});
    assert.equal(config.enabled, true);
    assert.equal(config.timezone, "Europe/Paris");
    assert.deepEqual(config.jobs.map((j) => j.expression), ["0 10 * * 3", "0 10 * * 5"]);
  });

  test("reads overrides from the environment", () => {
    const config = resolveSchedulerConfig({
      SCHEDULER_ENABLED: "false",
      SCHEDULER_TIMEZONE: "America/Toronto",
      SCHEDULER_MIDWEEK_CRON: "30 9 * * 2",
    });
    assert.equal(config.enabled, false);
    assert.equal(config.timezone, "America/Toronto");
    assert.equal(config.jobs[0].expression, "30 9 * * 2");
  });

  test("fails fast on invalid values", () => {
    assert.throws(() => resolveSchedulerConfig({ SCHEDULER_TIMEZONE: "Mars/Base" }), /timezone/);
    assert.throws(() => resolveSchedulerConfig({ SCHEDULER_ENDWEEK_CRON: "nope" }), /cron/);
  });
});
