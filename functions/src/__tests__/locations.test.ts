import { describe, expect, it } from "vitest";
import { nativeFallbackUpdateForAuth } from "../domain/locations.js";

describe("native location fallback", () => {
  it("binds fallback updates to the authenticated user", () => {
    const update = nativeFallbackUpdateForAuth(
      {
        rideSessionId: "ride-1",
        userId: "spoofed-user",
        role: "driver",
        lat: 50.715,
        lng: 4.612,
        accuracyM: 8,
        capturedAt: 1760000000000,
        source: "manual",
      },
      "driver-1",
      1760000005000,
    );

    expect(update).toMatchObject({
      rideSessionId: "ride-1",
      userId: "driver-1",
      role: "driver",
      source: "nativeFallback",
      uploadedAt: 1760000005000,
    });
  });
});
