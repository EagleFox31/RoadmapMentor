export type LegacyMentorshipPair = {
  mentorId: number;
  learnerId: number;
};

export function buildLegacyMentorshipPairs(
  mentorIds: number[],
  learnerIds: number[],
): LegacyMentorshipPair[] {
  const mentors = Array.from(new Set(mentorIds)).sort((a, b) => a - b);
  const learners = Array.from(new Set(learnerIds)).sort((a, b) => a - b);

  return mentors.flatMap((mentorId) =>
    learners.map((learnerId) => ({ mentorId, learnerId })),
  );
}
