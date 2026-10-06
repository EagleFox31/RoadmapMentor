import { ConflictError } from "./errors";
export type BillingStatus = "DUE" | "PARTIALLY_PAID" | "PAID" | "VOID";

export type MoneyLine = {
  amountMinor: number;
};

export function summarizeBilling(input: {
  baseAmountMinor: number;
  charges: MoneyLine[];
  payments: MoneyLine[];
  isVoid?: boolean;
}) {
  const extrasMinor = input.charges.reduce(
    (sum, charge) => sum + charge.amountMinor,
    0,
  );
  const subtotalMinor = input.baseAmountMinor + extrasMinor;
  const paidMinor = input.payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
  const outstandingMinor = Math.max(subtotalMinor - paidMinor, 0);

  let status: BillingStatus = "DUE";
  if (input.isVoid) {
    status = "VOID";
  } else if (subtotalMinor > 0 && outstandingMinor === 0) {
    status = "PAID";
  } else if (paidMinor > 0) {
    status = "PARTIALLY_PAID";
  }

  return {
    extrasMinor,
    subtotalMinor,
    paidMinor,
    outstandingMinor,
    status,
  };
}

export function assertCurrencyMatches(
  expectedCurrency: string,
  actualCurrency: string,
): void {
  if (expectedCurrency.toUpperCase() !== actualCurrency.toUpperCase()) {
    throw new ConflictError(
      `Currency mismatch: expected ${expectedCurrency.toUpperCase()}, received ${actualCurrency.toUpperCase()}`,
    );
  }
}
