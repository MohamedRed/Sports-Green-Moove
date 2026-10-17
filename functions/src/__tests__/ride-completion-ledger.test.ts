import { describe, expect, it } from "vitest";
import {
  buildRideCompletionCo2LedgerEntry,
  buildRideCompletionRewardLedgerEntry,
  rideCompletionCo2LedgerId,
  rideCompletionRewardLedgerId,
} from "../domain/rideCompletionLedger.js";

describe("ride completion ledger", () => {
  const input = {
    rideSessionId: "ride-1",
    driverUserId: "driver-1",
    distanceMeters: 12000,
    passengersSharing: 3,
    co2SavedKg: 3.2,
    rewardCents: 38,
    createdAt: "2026-06-13T10:00:00.000Z",
  };

  it("builds deterministic CO2 accounting entries for completed rides", () => {
    expect(rideCompletionCo2LedgerId("ride-1")).toBe("rideCompletion_ride-1");

    expect(buildRideCompletionCo2LedgerEntry(input)).toEqual({
      id: "rideCompletion_ride-1",
      userId: "driver-1",
      type: "rideCompletion",
      sourceId: "ride-1",
      rideSessionId: "ride-1",
      driverUserId: "driver-1",
      distanceMeters: 12000,
      passengersSharing: 3,
      co2SavedKg: 3.2,
      createdAt: "2026-06-13T10:00:00.000Z",
    });
  });

  it("builds deterministic driver CO2 bonus ledger entries", () => {
    expect(rideCompletionRewardLedgerId("ride/1", "driver-1")).toBe("co2Bonus_ride%2F1_driver-1");

    expect(buildRideCompletionRewardLedgerEntry(input)).toEqual({
      id: "co2Bonus_ride-1_driver-1",
      userId: "driver-1",
      type: "co2Bonus",
      amountCents: 38,
      currency: "eur",
      sourceId: "ride-1",
      rideSessionId: "ride-1",
      co2SavedKg: 3.2,
      createdAt: "2026-06-13T10:00:00.000Z",
    });
  });

  it("does not create zero-value reward entries", () => {
    expect(buildRideCompletionRewardLedgerEntry({ ...input, rewardCents: 0 })).toBeNull();
  });
});
