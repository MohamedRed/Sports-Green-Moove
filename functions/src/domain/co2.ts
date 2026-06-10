import type { Co2Factors } from "./types.js";

export const defaultCo2Factors: Co2Factors = {
  gramsPerKmByCar: 171,
  sharedRideCreditRatio: 0.78,
};

export function estimateCo2SavedKg(
  distanceMeters: number,
  passengersSharing: number,
  factors = defaultCo2Factors,
): number {
  if (distanceMeters <= 0 || passengersSharing <= 0) return 0;
  const km = distanceMeters / 1000;
  const avoidedSoloTrips = Math.max(0, passengersSharing - 1);
  const grams = km * factors.gramsPerKmByCar * avoidedSoloTrips * factors.sharedRideCreditRatio;
  return Math.round((grams / 1000) * 100) / 100;
}
