import type { RewardLedgerEntry } from "./types.js";

export function computeRewardBalanceCents(entries: RewardLedgerEntry[], userId: string): number {
  return entries
    .filter((entry) => entry.userId === userId)
    .reduce((total, entry) => total + entry.amountCents, 0);
}

export function rewardForCo2Saved(co2SavedKg: number): number {
  if (co2SavedKg <= 0) return 0;
  return Math.round(co2SavedKg * 12);
}

