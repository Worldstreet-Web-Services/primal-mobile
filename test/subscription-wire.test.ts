import { describe, expect, test } from "bun:test";

import {
  chainIdNumber,
  integerString,
  readPayment,
  readSubscription,
} from "../src/lib/gateway/subscriptionWire";
import { protoTimestampToDate } from "../src/lib/gateway/time";

describe("subscription wire boundary", () => {
  test("preserves string and safe numeric integers exactly", () => {
    expect(integerString("1000000000")).toBe("1000000000");
    expect(integerString(100)).toBe("100");
    expect(integerString(1.5)).toBeNull();
    expect(integerString(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  test("accepts protobuf chain ids encoded as strings", () => {
    expect(chainIdNumber("8453")).toBe(8453);
    expect(chainIdNumber(8453)).toBe(8453);
    expect(chainIdNumber("0")).toBeNull();
    expect(chainIdNumber("not-a-chain")).toBeNull();
  });

  test("reads the deployed flat subscription price, including a $1 test plan", () => {
    const subscription = readSubscription({
      id: "sub-1",
      planCode: "premium-monthly-v1",
      status: "PENDING_PAYMENT",
      amountMinor: 100,
      currency: "USD",
    });

    expect(subscription?.price).toEqual({ amountMinor: "100", currency: "USD" });
    expect(subscription?.planCode).toBe("premium-monthly-v1");
  });

  test("normalizes the production payment example without losing int64 fields", () => {
    const payment = readPayment({
      payment: {
        id: "pay-1",
        subscriptionId: "sub-1",
        provider: "DEXTOPUS",
        providerRequestId: "provider-ref",
        depositAddress: "0x1111111111111111111111111111111111111111",
        originChainId: "8453",
        originAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        originAmount: "1002506266",
        settlementChainId: "8453",
        settlementAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        requiredSettlementAmount: "1000000000",
        quotedSettlementAmount: 1000000000,
        status: "AWAITING_TRANSFER",
        expiresAt: { seconds: "1786882500", nanos: 0 },
      },
    });

    expect(payment).toMatchObject({
      originChainId: 8453,
      settlementChainId: 8453,
      originAmount: "1002506266",
      requiredSettlementAmount: "1000000000",
      quotedSettlementAmount: "1000000000",
      status: "AWAITING_TRANSFER",
    });
  });

  test("fails closed when a payment has no deposit address", () => {
    expect(readPayment({ payment: { id: "pay-1", status: "AWAITING_TRANSFER" } })).toBeNull();
  });

  test("converts protobuf expiry seconds and nanos without string coercion loss", () => {
    expect(
      protoTimestampToDate({ seconds: "1786882500", nanos: 123_000_000 })?.toISOString(),
    ).toBe("2026-08-16T12:15:00.123Z");
  });
});
