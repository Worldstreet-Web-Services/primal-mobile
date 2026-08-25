import { beforeEach, describe, expect, mock, test } from "bun:test";

let storedIntent: string | null = null;
let failRead = false;
let failWrite = false;
let failDelete = false;

mock.module("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

mock.module("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  getItemAsync: async () => {
    if (failRead) throw new Error("keychain unavailable");
    return storedIntent;
  },
  setItemAsync: async (_key: string, value: string) => {
    if (failWrite) throw new Error("keychain unavailable");
    storedIntent = value;
  },
  deleteItemAsync: async () => {
    if (failDelete) throw new Error("keychain unavailable");
    storedIntent = null;
  },
}));

mock.module("react-native", () => ({ Platform: { OS: "ios" } }));

const subs = await import("../src/lib/gateway/subscription");
const entitlement = await import("../src/lib/gateway/entitlement");

describe("subscription production policy", () => {
  beforeEach(() => {
    storedIntent = null;
    failRead = false;
    failWrite = false;
    failDelete = false;
  });

  test("formats the exact grossed-up origin quote from a string chain id", () => {
    const payment = subs.readPayment({
      depositAddress: "0x1111111111111111111111111111111111111111",
      originChainId: "8453",
      originAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      originAmount: "1002506266",
      status: "AWAITING_TRANSFER",
    });

    expect(subs.readOriginQuote(payment)).toMatchObject({
      networkName: "Base",
      amountText: "1,002.506266",
      amountPlain: "1002.506266",
      safe: true,
    });
  });

  test("refuses an unknown asset or malformed deposit address", () => {
    const unknownAsset = subs.readPayment({
      depositAddress: "0x1111111111111111111111111111111111111111",
      originChainId: 8453,
      originAsset: "0x2222222222222222222222222222222222222222",
      originAmount: "1000000",
      status: "AWAITING_TRANSFER",
    });
    const badAddress = subs.readPayment({
      depositAddress: "not-an-address",
      originChainId: 8453,
      originAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      originAmount: "1000000",
      status: "AWAITING_TRANSFER",
    });

    expect(subs.readOriginQuote(unknownAsset).safe).toBe(false);
    expect(subs.readOriginQuote(badAddress).safe).toBe(false);
  });

  test("fails closed when secure storage cannot be read", async () => {
    failRead = true;
    await expect(subs.loadIntent()).rejects.toBeInstanceOf(subs.CheckoutStorageError);
  });

  test("does not send checkout POST when the idempotency intent cannot be saved", async () => {
    failWrite = true;
    await expect(
      subs.startCheckout({
        originChainId: 8453,
        originAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        refundTo: "0x1111111111111111111111111111111111111111",
      }),
    ).rejects.toBeInstanceOf(subs.CheckoutStorageError);
  });

  test("blocks a new operation when an old intent cannot be cleared", async () => {
    failDelete = true;
    await expect(subs.clearIntent({ required: true })).rejects.toBeInstanceOf(
      subs.CheckoutStorageError,
    );
  });

  test("derives payment and entitlement propagation states separately", () => {
    expect(
      entitlement.deriveState({
        entitled: false,
        subscription: { id: "sub", status: "PENDING_PAYMENT" },
      }),
    ).toBe("payment_pending");
    expect(
      entitlement.deriveState({
        entitled: false,
        subscription: { id: "sub", status: "ACTIVE" },
      }),
    ).toBe("entitlement_syncing");
    expect(
      entitlement.deriveState({
        entitled: true,
        subscription: { id: "sub", status: "CANCEL_AT_PERIOD_END" },
      }),
    ).toBe("cancel_at_period_end");
  });

  test("visible success polling stays within the contract cadence", () => {
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      expect(subs.nextPollDelayMs({ visible: true, failures: 0 })).toBe(7_500);
      expect(subs.nextPollDelayMs({ visible: false, failures: 0 })).toBe(
        subs.POLL_BACKGROUND_MS,
      );
      expect(subs.nextPollDelayMs({ visible: true, failures: 1 })).toBe(5_000);
    } finally {
      Math.random = original;
    }
  });
});
