export type PaymentProviderName = "MANUAL";

export type PaymentCapture = {
  amountMinor: number;
  currency: string;
  paidAt: Date;
  method: string | null;
  providerReference: string | null;
  note: string | null;
};

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;
  capture(input: PaymentCapture): Promise<PaymentCapture>;
}

// Manual entry is the first provider. Future CinetPay/CamPay/etc. adapters can
// implement the same contract without changing billing-period logic.
export const manualPaymentAdapter: PaymentProviderAdapter = {
  name: "MANUAL",
  async capture(input) {
    return input;
  },
};
