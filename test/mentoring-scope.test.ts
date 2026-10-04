import test from "node:test";
import assert from "node:assert/strict";
import {
  changeRequestDecisionSchema,
  createChangeRequestSchema,
  createMentoringPackageSchema,
  quoteChangeRequestSchema,
} from "../shared/schema";
import {
  assertChangeRequestTransition,
  canTransitionChangeRequest,
  requiresLinkedRoadmapWork,
} from "../server/domain/changeRequest";

test("a Pavel-style XAF weekend package is valid", () => {
  const parsed = createMentoringPackageSchema.parse({
    title: "Octobre 2026 — ShopFlow / PCAP",
    basePriceMinor: 30000,
    currency: "xaf",
    periodStart: "2026-10-03",
    periodEnd: "2026-10-25",
    includedSessionCount: 8,
    includedSessionDurationMinutes: 180,
    sessionSchedule: "Samedi et dimanche 16:00-19:00",
    scopeDescription:
      "Accompagnement du mois 1 sur ShopFlow et préparation PCAP pendant les séances du week-end.",
    scopeItems: [
      {
        title: "Sessions du week-end",
        description: "8 séances guidées de 3 heures.",
      },
      {
        title: "Roadmap Mois 1",
        description: "Git/GitHub, Python, FastAPI, schémas, tests et examen blanc PCAP.",
      },
    ],
  });

  assert.equal(parsed.basePriceMinor, 30000);
  assert.equal(parsed.currency, "XAF");
  assert.equal(parsed.includedSessionCount, 8);
  assert.equal(parsed.scopeItems.length, 2);
});

test("a package cannot end before it starts", () => {
  assert.throws(() =>
    createMentoringPackageSchema.parse({
      title: "Invalid package",
      basePriceMinor: 30000,
      currency: "XAF",
      periodStart: "2026-10-31",
      periodEnd: "2026-10-01",
      includedSessionCount: 8,
      includedSessionDurationMinutes: 180,
      scopeDescription: "Invalid date range",
      scopeItems: [{ title: "Weekend sessions" }],
    }),
  );
});

test("a scope change must reference the package whose scope is being extended", () => {
  assert.throws(() =>
    createChangeRequestSchema.parse({
      title: "Add Kubernetes",
      description: "New topic outside the agreed month scope.",
    }),
  );

  const parsed = createChangeRequestSchema.parse({
    packageId: 42,
    title: "Add Kubernetes",
    description: "New topic outside the agreed month scope.",
  });

  assert.equal(parsed.packageId, 42);
});

test("quotes require a concrete price and linked roadmap task", () => {
  assert.throws(() =>
    quoteChangeRequestSchema.parse({
      quotedPriceMinor: 10000,
      currency: "XAF",
    }),
  );

  const quote = quoteChangeRequestSchema.parse({
    quotedPriceMinor: 10000,
    currency: "xaf",
    linkedTaskId: 99,
  });

  assert.equal(quote.currency, "XAF");
  assert.equal(quote.linkedTaskId, 99);
});

test("scope change lifecycle only allows forward business transitions", () => {
  assert.equal(canTransitionChangeRequest("PROPOSED", "QUOTED"), true);
  assert.equal(canTransitionChangeRequest("QUOTED", "ACCEPTED"), true);
  assert.equal(canTransitionChangeRequest("QUOTED", "REJECTED"), true);
  assert.equal(canTransitionChangeRequest("ACCEPTED", "DELIVERED"), true);

  assert.equal(canTransitionChangeRequest("PROPOSED", "ACCEPTED"), false);
  assert.equal(canTransitionChangeRequest("REJECTED", "QUOTED"), false);
  assert.equal(canTransitionChangeRequest("DELIVERED", "ACCEPTED"), false);

  assert.throws(
    () => assertChangeRequestTransition("PROPOSED", "ACCEPTED"),
    /Invalid change request transition/,
  );
});

test("accepted and delivered changes must stay linked to roadmap work", () => {
  assert.equal(requiresLinkedRoadmapWork("PROPOSED"), false);
  assert.equal(requiresLinkedRoadmapWork("QUOTED"), false);
  assert.equal(requiresLinkedRoadmapWork("ACCEPTED"), true);
  assert.equal(requiresLinkedRoadmapWork("DELIVERED"), true);
});

test("learner decision payload only accepts accept or reject", () => {
  assert.deepEqual(
    changeRequestDecisionSchema.parse({ decision: "ACCEPT" }),
    { decision: "ACCEPT" },
  );
  assert.throws(() =>
    changeRequestDecisionSchema.parse({ decision: "MAYBE" }),
  );
});
