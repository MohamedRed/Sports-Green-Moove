import { describe, expect, it } from "vitest";
import { estimateCo2SavedKg } from "../domain/co2.js";
import { computeRewardBalanceCents, rewardForCo2Saved } from "../domain/rewards.js";

describe("CO2 and rewards", () => {
  it("estimates shared ride CO2 savings", () => {
    expect(estimateCo2SavedKg(10000, 3)).toBeGreaterThan(2);
  });

  it("computes immutable ledger balance", () => {
    const balance = computeRewardBalanceCents([
      { id: "1", userId: "u1", type: "driverEarning", amountCents: 500, currency: "eur", sourceId: "ride-1", createdAt: "2026-01-01" },
      { id: "2", userId: "u1", type: "payout", amountCents: -200, currency: "eur", sourceId: "po-1", createdAt: "2026-01-02" },
      { id: "3", userId: "u2", type: "driverEarning", amountCents: 900, currency: "eur", sourceId: "ride-2", createdAt: "2026-01-03" },
    ], "u1");

    expect(balance).toBe(300);
    const entry = { id: "invalid", userId: "u1", type: "manualAdjustment" as const, amountCents: 1,
      currency: "eur" as const, sourceId: "synthetic", createdAt: "2026-10-23" };
    for (const amountCents of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => computeRewardBalanceCents([{ ...entry, amountCents }], "u1")).toThrow(RangeError);
    expect(() => computeRewardBalanceCents([{ ...entry, amountCents: Number.MAX_SAFE_INTEGER }, entry], "u1")).toThrow(RangeError);
  });

  it("creates a small CO2 bonus in cents", () => {
    expect(rewardForCo2Saved(4.25)).toBe(51);
  });
});

