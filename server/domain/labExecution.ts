import type { LabSubmission, LabSubmissionView } from "@shared/schema";

/** Never trust learner-provided execution output, even after mentor review. */
export function asLabSubmissionView(submission: LabSubmission): LabSubmissionView {
  return { ...submission, executionTrust: "CLIENT_UNVERIFIED" };
}
