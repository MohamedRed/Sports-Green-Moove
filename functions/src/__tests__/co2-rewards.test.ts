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
  });

  it("creates a small CO2 bonus in cents", () => {
    expect(rewardForCo2Saved(4.25)).toBe(51);
  });
});

