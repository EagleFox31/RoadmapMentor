import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { api, BASE, mentoringFixture, run } from "./support/api";

describe("lab execution provenance", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  test("never trusts learner-supplied execution output or trust flags", async () => {
    const { mentorA, learner, roadmapId } = await mentoringFixture("lab-trust");
    const week = await api("POST", "/api/weeks", mentorA.token, {
      roadmapId, number: 1, title: `Trust ${run}`,
      startDate: "2026-10-05", endDate: "2026-10-11",
    });
    assert.equal(week.status, 201, JSON.stringify(week.data));
    const lab = await api("POST", `/api/weeks/${week.data.id}/labs`, mentorA.token, {
      title: "Exercice guidé", instructions: "Écrire une fonction Python",
      estimatedMinutes: 20, isPublished: true,
    });
    assert.equal(lab.status, 201, JSON.stringify(lab.data));
    assert.equal((await api("POST", `/api/weeks/${week.data.id}/validate`, mentorA.token)).status, 200);

    const spoof = await api("PUT", `/api/labs/${lab.data.id}/submission`, learner.token, {
      code: "print('ok')", output: "Tests réussis", submit: true,
      executionTrust: "SERVER_VERIFIED",
    });
    assert.equal(spoof.status, 400, JSON.stringify(spoof.data));
    const submitted = await api("PUT", `/api/labs/${lab.data.id}/submission`, learner.token, {
      code: "print('ok')", output: "Tests réussis", submit: true,
    });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
    assert.equal(submitted.data.executionTrust, "CLIENT_UNVERIFIED");

    for (const token of [learner.token, mentorA.token]) {
      const weeks = await api("GET", `/api/weeks?roadmapId=${roadmapId}`, token);
      assert.equal(weeks.status, 200, JSON.stringify(weeks.data));
      const entry = weeks.data[0].labs.find((row: any) => row.id === lab.data.id);
      assert.equal(entry.submissions[0].executionTrust, "CLIENT_UNVERIFIED");
    }
    const approved = await api("POST", `/api/lab-submissions/${submitted.data.id}/review`, mentorA.token, {
      decision: "APPROVE",
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal(approved.data.status, "APPROVED");
    assert.equal(approved.data.executionTrust, "CLIENT_UNVERIFIED");
  });
});
