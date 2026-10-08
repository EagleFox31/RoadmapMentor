import assert from "node:assert/strict";
import { test } from "node:test";
import { asLabSubmissionView } from "../server/domain/labExecution";
import type { LabSubmission } from "../shared/schema";

test("learner output cannot claim verified execution, even if approved", () => {
  for (const status of ["SUBMITTED", "APPROVED"] as const) {
    const stored = {
      id: 1, code: "print('ok')", output: "Tests réussis", status,
      executionTrust: "SERVER_VERIFIED",
    } as unknown as LabSubmission;
    const result = asLabSubmissionView(stored);
    assert.equal(result.executionTrust, "CLIENT_UNVERIFIED");
    assert.equal(result.status, status);
    assert.equal(result.output, "Tests réussis");
  }
});
