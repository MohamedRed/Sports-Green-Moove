import type { RewardLedgerEntry } from "./types.js";

export type RideCompletionLedgerInput = {
  rideSessionId: string;
  driverUserId: string;
  distanceMeters: number;
  passengersSharing: number;
  co2SavedKg: number;
  rewardCents: number;
  createdAt: string;
};

export type RideCompletionCo2LedgerEntry = {
  id: string;
  userId: string;
  type: "rideCompletion";
  sourceId: string;
  rideSessionId: string;
  driverUserId: string;
  distanceMeters: number;
  passengersSharing: number;
  co2SavedKg: number;
  createdAt: string;
};

export type RideCompletionRewardLedgerEntry = RewardLedgerEntry & {
  rideSessionId: string;
  co2SavedKg: number;
};

export function rideCompletionCo2LedgerId(rideSessionId: string): string {
  return `rideCompletion_${ledgerIdSegment(rideSessionId)}`;
}

export function rideCompletionRewardLedgerId(rideSessionId: string, driverUserId: string): string {
  return `co2Bonus_${ledgerIdSegment(rideSessionId)}_${ledgerIdSegment(driverUserId)}`;
}

export function buildRideCompletionCo2LedgerEntry(
  input: RideCompletionLedgerInput,
): RideCompletionCo2LedgerEntry {
  const id = rideCompletionCo2LedgerId(input.rideSessionId);
  return {
    id,
    userId: input.driverUserId,
    type: "rideCompletion",
    sourceId: input.rideSessionId,
    rideSessionId: input.rideSessionId,
    driverUserId: input.driverUserId,
    distanceMeters: input.distanceMeters,
    passengersSharing: input.passengersSharing,
    co2SavedKg: input.co2SavedKg,
    createdAt: input.createdAt,
  };
}

export function buildRideCompletionRewardLedgerEntry(
  input: RideCompletionLedgerInput,
): RideCompletionRewardLedgerEntry | null {
  if (input.rewardCents <= 0) return null;
  const id = rideCompletionRewardLedgerId(input.rideSessionId, input.driverUserId);
  return {
    id,
    userId: input.driverUserId,
    type: "co2Bonus",
    amountCents: input.rewardCents,
    currency: "eur",
    sourceId: input.rideSessionId,
    rideSessionId: input.rideSessionId,
    co2SavedKg: input.co2SavedKg,
    createdAt: input.createdAt,
  };
}

function ledgerIdSegment(value: string): string {
  const encoded = encodeURIComponent(value);
  if (!encoded) throw new Error("Ledger id segment must not be empty.");
  return encoded;
}
