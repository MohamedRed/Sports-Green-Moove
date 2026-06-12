import { describe, expect, it } from "vitest";
import type { SearchRequest, Trip } from "../domain/types.js";
import {
  GoogleRoutesConfigurationError,
  GoogleRoutesProvider,
  type GoogleRoutesFetch,
} from "../services/googleRoutes.js";

const request: SearchRequest = {
  requesterUserId: "parent-1",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  desiredDepartureAt: "2026-09-12T14:30:00.000Z",
  origin: { lat: 50.715, lng: 4.612 },
  destination: { lat: 50.67, lng: 4.58 },
  seatsNeeded: 1,
  baggage: "medium",
  returnTrip: false,
  requireChildTracking: false,
  guardianConsent: true,
};

const trip: Trip = {
  id: "trip-1",
  driverUserId: "driver-1",
  status: "published",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  departureAt: "2026-09-12T14:35:00.000Z",
  origin: { lat: 50.716, lng: 4.611 },
  destination: { lat: 50.671, lng: 4.581 },
  pickupRadiusM: 2000,
  seatsTotal: 4,
  seatsAvailable: 2,
  baggage: "large",
  returnTrip: false,
  priceCents: 250,
  driverRating: 4.8,
  driverVerified: true,
  supportsVehicleTracking: true,
  supportsChildTracking: false,
  co2SavedKgEstimate: 4.2,
};

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

describe("GoogleRoutesProvider", () => {
  it("requires an API key instead of silently estimating locally", async () => {
    const provider = new GoogleRoutesProvider({ apiKey: "", fetcher: async () => jsonResponse([]) });

    await expect(provider.compareDetour(request, trip)).rejects.toBeInstanceOf(GoogleRoutesConfigurationError);
  });

  it("uses Route Matrix for detour and Compute Routes for final route details", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: GoogleRoutesFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/distanceMatrix/v2:computeRouteMatrix")) {
        return jsonResponse([
          { originIndex: 0, destinationIndex: 2, condition: "ROUTE_EXISTS", distanceMeters: 5000, duration: "600s" },
          { originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", distanceMeters: 500, duration: "120s" },
          { originIndex: 1, destinationIndex: 1, condition: "ROUTE_EXISTS", distanceMeters: 2500, duration: "300s" },
          { originIndex: 2, destinationIndex: 2, condition: "ROUTE_EXISTS", distanceMeters: 2600, duration: "240s" },
        ]);
      }
      return jsonResponse({
        routes: [{ distanceMeters: 5600, duration: "660s", polyline: { encodedPolyline: "encoded-route" } }],
      });
    };

    const provider = new GoogleRoutesProvider({ apiKey: "test-key", fetcher, baseUrl: "https://routes.test" });
    const route = await provider.compareDetour(request, trip);

    expect(route.baselineDistanceMeters).toBe(5000);
    expect(route.detourDistanceMeters).toBe(600);
    expect(route.detourDurationSeconds).toBe(60);
    expect(route.pickupDistanceMeters).toBe(500);
    expect(route.finalDistanceMeters).toBe(5600);
    expect(route.finalDurationSeconds).toBe(660);
    expect(route.finalEncodedPolyline).toBe("encoded-route");
    expect(calls).toHaveLength(2);
    expect(calls[0].init.headers).toMatchObject({
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration",
    });
    expect(calls[1].init.headers).toMatchObject({
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    });
    expect(JSON.parse(String(calls[0].init.body)).origins).toHaveLength(3);
    expect(JSON.parse(String(calls[1].init.body)).intermediates).toHaveLength(2);
  });
});
