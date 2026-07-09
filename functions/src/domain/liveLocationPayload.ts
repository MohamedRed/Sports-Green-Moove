import type { LocationUpdate } from "./types.js";

export function liveLocationPayload(update: LocationUpdate): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      ...update,
      uploadedAt: update.uploadedAt ?? Date.now(),
    }).filter(([, value]) => value !== undefined),
  );
}
