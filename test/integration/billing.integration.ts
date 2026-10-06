import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { api, BASE, createPackage, expectAccess, mentoringFixture, type MentoringFixture } from "./support/api";

describe("billing periods, charges and payments", { skip: !BASE && "TEST_BASE_URL not set" }, () => {
  let f: MentoringFixture;
  let packageId: number;
  let periodId: number;
  let voidablePeriodId: number;
  const billing = () => `/api/mentorships/${f.mentorshipId}/billing`;
  const detail = async (id: number) => {
    const res = await api("GET", billing(), f.mentorA.token);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data.find((p: any) => p.id === id);
  };

  before(async () => {
    f = await mentoringFixture("billing");
    packageId = (await createPackage(f, { basePriceMinor: 100000 })).id;
  });

  test("a period is created once per package (idempotent)", async () => {
    const created = await api("POST", `/api/mentorships/${f.mentorshipId}/billing-periods`, f.mentorA.token, { packageId, dueDate: "2026-04-05" });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    periodId = created.data.id;
    assert.equal(created.data.baseAmountMinor, 100000);
    assert.equal(created.data.status, "DUE");

    const again = await api("POST", `/api/mentorships/${f.mentorshipId}/billing-periods`, f.mentorA.token, { packageId, dueDate: "2026-04-05" });
    assert.equal(again.status, 200);
    assert.equal(again.data.id, periodId);
    assert.equal((await api("GET", billing(), f.mentorA.token)).data.length, 1);
  });

  test("charges and payments move subtotal, outstanding balance and status", async () => {
    const charge = await api("POST", `/api/billing-periods/${periodId}/charges`, f.mentorA.token, { description: "Atelier", amountMinor: 20000 });
    assert.equal(charge.status, 201, JSON.stringify(charge.data));
    let d = await detail(periodId);
    assert.equal(d.subtotalMinor, 120000);
    assert.equal(d.outstandingMinor, 120000);

    const partial = await api("POST", `/api/billing-periods/${periodId}/payments`, f.mentorA.token, { amountMinor: 50000, method: "virement" });
    assert.equal(partial.status, 201, JSON.stringify(partial.data));
    d = await detail(periodId);
    assert.equal(d.paidMinor, 50000);
    assert.equal(d.outstandingMinor, 70000);
    assert.equal(d.status, "PARTIALLY_PAID");

    const full = await api("POST", `/api/billing-periods/${periodId}/payments`, f.mentorA.token, { amountMinor: 70000 });
    assert.equal(full.status, 201);
    d = await detail(periodId);
    assert.equal(d.outstandingMinor, 0);
    assert.equal(d.status, "PAID");

    // The learner of the mentorship reads the same figures.
    const asLearner = await api("GET", billing(), f.learner.token);
    assert.equal(asLearner.status, 200);
    assert.equal(asLearner.data.find((p: any) => p.id === periodId).status, "PAID");
  });

  test("overpayment and invalid amounts are rejected without changing balances", async () => {
    const pay = (body: unknown) => api("POST", `/api/billing-periods/${periodId}/payments`, f.mentorA.token, body);
    assert.equal((await pay({ amountMinor: 1 })).status, 409, "period already settled");
    assert.equal((await pay({ amountMinor: -5 })).status, 400);
    assert.equal((await pay({ amountMinor: 0 })).status, 400);
    assert.equal((await pay({ amountMinor: 1.5 })).status, 400);
    const charge = (body: unknown) => api("POST", `/api/billing-periods/${periodId}/charges`, f.mentorA.token, body);
    assert.equal((await charge({ description: "x", amountMinor: -1 })).status, 400);
    assert.equal((await charge({ description: "", amountMinor: 1 })).status, 400);
    const d = await detail(periodId);
    assert.equal(d.paidMinor, 120000);
    assert.equal(d.subtotalMinor, 120000);
  });

  test("an additional priced session is billed on completion", async () => {
    const other = await createPackage(f, { title: "Forfait avril", periodStart: "2026-04-01", periodEnd: "2026-04-30", basePriceMinor: 10000 });
    const period = await api("POST", `/api/mentorships/${f.mentorshipId}/billing-periods`, f.mentorA.token, { packageId: other.id, dueDate: "2026-05-05" });
    voidablePeriodId = period.data.id;

    const session = await api("POST", `/api/mentorships/${f.mentorshipId}/sessions`, f.mentorA.token, {
      title: "Séance additionnelle",
      isAdditional: true,
      additionalPriceMinor: 7000,
      additionalPriceCurrency: "XAF",
      startsAt: "2026-04-10T10:00:00.000Z",
      endsAt: "2026-04-10T11:00:00.000Z",
    });
    assert.equal(session.status, 201, JSON.stringify(session.data));
    assert.equal((await detail(voidablePeriodId)).subtotalMinor, 10000, "not billed before completion");

    const done = await api("POST", `/api/sessions/${session.data.id}/complete`, f.mentorA.token, { learnerAttended: true });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal((await detail(voidablePeriodId)).subtotalMinor, 17000);

    // Reconciling again must not bill the same session twice.
    const rec = await api("POST", `/api/billing-periods/${voidablePeriodId}/reconcile`, f.mentorA.token);
    assert.equal(rec.status, 200, JSON.stringify(rec.data));
    assert.equal((await detail(voidablePeriodId)).subtotalMinor, 17000);
  });

  test("invalid period creation is a 4xx", async () => {
    const create = (body: unknown) => api("POST", `/api/mentorships/${f.mentorshipId}/billing-periods`, f.mentorA.token, body);
    assert.equal((await create({ packageId: 999999, dueDate: "2026-04-05" })).status, 400);
    assert.equal((await create({ packageId, dueDate: "5 avril" })).status, 400);
    assert.equal((await create({})).status, 400);
  });

  describe("access matrix", () => {
    const pay = () => `/api/billing-periods/${voidablePeriodId}/payments`;
    const charge = () => `/api/billing-periods/${voidablePeriodId}/charges`;
    const reconcile = () => `/api/billing-periods/${voidablePeriodId}/reconcile`;
    const periods = () => `/api/mentorships/${f.mentorshipId}/billing-periods`;
    const tokens: MentoringFixture["tokens"] = {
      mentorA: () => f.tokens.mentorA(),
      mentorB: () => f.tokens.mentorB(),
      learner: () => f.tokens.learner(),
      outsider: () => f.tokens.outsider(),
      anonymous: () => undefined,
    };
    expectAccess(tokens, [
      ["GET", billing, "outsider", undefined, 404],
      ["GET", billing, "mentorB", undefined, 404],
      ["GET", billing, "anonymous", undefined, 401],
      // The learner reads billing but never writes it.
      ["POST", periods, "learner", { packageId: 1, dueDate: "2026-04-05" }, 403],
      ["POST", charge, "learner", { description: "x", amountMinor: 1 }, 403],
      ["POST", pay, "learner", { amountMinor: 1 }, 403],
      ["POST", reconcile, "learner", undefined, 403],
      // A mentor outside the mentorship never reaches its periods.
      ["POST", periods, "mentorB", { packageId: 1, dueDate: "2026-04-05" }, 404],
      ["POST", charge, "mentorB", { description: "x", amountMinor: 1 }, 404],
      ["POST", pay, "mentorB", { amountMinor: 1 }, 404],
      ["POST", reconcile, "mentorB", undefined, 404],
      ["POST", pay, "anonymous", { amountMinor: 1 }, 401],
    ]);

    test("denied writes left the balances untouched", async () => {
      const d = await detail(voidablePeriodId);
      assert.equal(d.paidMinor, 0);
      assert.equal(d.subtotalMinor, 17000);
    });
  });
});
