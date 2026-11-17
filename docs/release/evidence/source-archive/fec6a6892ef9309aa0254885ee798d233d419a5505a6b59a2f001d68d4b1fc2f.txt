import type { LocationUpdate } from "./types.js";

export type NativeLocationUpdateInput = Omit<LocationUpdate, "userId" | "uploadedAt" | "source"> & {
  userId?: string;
  uploadedAt?: number;
  source?: LocationUpdate["source"];
};

export function nativeFallbackUpdateForAuth(
  update: NativeLocationUpdateInput,
  uid: string,
  uploadedAt = Date.now(),
): LocationUpdate {
  return {
    ...update,
    userId: uid,
    uploadedAt: update.uploadedAt ?? uploadedAt,
    source: "nativeFallback",
  };
}
