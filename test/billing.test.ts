import test from "node:test";
import assert from "node:assert/strict";
import {
  createBillingPeriodSchema,
  recordManualPaymentSchema,
  scheduleMentoringSessionSchema,
} from "../shared/schema";
import {
  assertCurrencyMatches,
  summarizeBilling,
} from "../server/domain/billing";
import { manualPaymentAdapter } from "../server/payments/provider";

test("billing summary includes package base price and extras", () => {
  const summary = summarizeBilling({
    baseAmountMinor: 30000,
    charges: [{ amountMinor: 10000 }, { amountMinor: 5000 }],
    payments: [{ amountMinor: 20000 }],
  });

  assert.equal(summary.extrasMinor, 15000);
  assert.equal(summary.subtotalMinor, 45000);
  assert.equal(summary.paidMinor, 20000);
  assert.equal(summary.outstandingMinor, 25000);
  assert.equal(summary.status, "PARTIALLY_PAID");
});

test("billing becomes paid when recorded payments cover the total", () => {
  const summary = summarizeBilling({
    baseAmountMinor: 30000,
    charges: [{ amountMinor: 5000 }],
    payments: [{ amountMinor: 35000 }],
  });

  assert.equal(summary.outstandingMinor, 0);
  assert.equal(summary.status, "PAID");
});

test("billing period creation references a package and due date", () => {
  assert.deepEqual(
    createBillingPeriodSchema.parse({
      packageId: 7,
      dueDate: "2026-10-10",
    }),
    {
      packageId: 7,
      dueDate: "2026-10-10",
    },
  );
});

test("manual payments require a positive amount", () => {
  assert.throws(() =>
    recordManualPaymentSchema.parse({
      amountMinor: 0,
    }),
  );

  const parsed = recordManualPaymentSchema.parse({
    amountMinor: 30000,
    method: "Mobile Money",
    providerReference: "MANUAL-001",
  });

  assert.equal(parsed.amountMinor, 30000);
});

test("additional mentoring sessions require an explicit price and currency", () => {
  assert.throws(() =>
    scheduleMentoringSessionSchema.parse({
      title: "Extra session",
      startsAt: "2026-10-14T18:00:00+01:00",
      endsAt: "2026-10-14T19:00:00+01:00",
      isAdditional: true,
    }),
  );

  const parsed = scheduleMentoringSessionSchema.parse({
    title: "Extra session",
    startsAt: "2026-10-14T18:00:00+01:00",
    endsAt: "2026-10-14T19:00:00+01:00",
    isAdditional: true,
    additionalPriceMinor: 10000,
    additionalPriceCurrency: "xaf",
  });

  assert.equal(parsed.additionalPriceMinor, 10000);
  assert.equal(parsed.additionalPriceCurrency, "XAF");
});

test("billing rejects mixed currencies", () => {
  assert.throws(
    () => assertCurrencyMatches("XAF", "EUR"),
    /Currency mismatch/,
  );
  assert.doesNotThrow(() => assertCurrencyMatches("xaf", "XAF"));
});

test("manual payment adapter preserves payment data without gateway coupling", async () => {
  const capture = await manualPaymentAdapter.capture({
    amountMinor: 30000,
    currency: "XAF",
    paidAt: new Date("2026-10-04T12:00:00Z"),
    method: "Orange Money",
    providerReference: "OM-REF-001",
    note: null,
  });

  assert.equal(capture.amountMinor, 30000);
  assert.equal(capture.currency, "XAF");
  assert.equal(capture.method, "Orange Money");
});
