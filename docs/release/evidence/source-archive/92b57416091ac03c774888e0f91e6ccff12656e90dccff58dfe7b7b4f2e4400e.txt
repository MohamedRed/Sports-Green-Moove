import type { LocationUpdate } from "./types.js";

function observationTime(value: unknown, now: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= now ? value : null;
}

export function hasValidLocationCapture(incoming: LocationUpdate, now: number): boolean {
  return observationTime(incoming.capturedAt, now) != null;
}

export function shouldReplaceLiveLocation(current: unknown, incoming: LocationUpdate, now: number): boolean {
  const nextTime = observationTime(incoming.capturedAt, now);
  if (nextTime == null) return false;
  const previous = current != null && typeof current === "object" && !Array.isArray(current)
    ? observationTime((current as Record<string, unknown>).capturedAt, now) : null;
  return previous == null || nextTime > previous;
}
