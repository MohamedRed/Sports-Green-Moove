import { RouteUnavailableError, type RouteComparisonProvider } from "../domain/matching.js";
import type { LatLng, RouteComparison, SearchRequest, Trip } from "../domain/types.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type GoogleRoutesFetch = (url: string, init: RequestInit) => Promise<FetchResponse>;

type GoogleRoutesProviderOptions = {
  apiKey?: string;
  fetcher?: GoogleRoutesFetch;
  baseUrl?: string;
};

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: {
    code?: number;
    message?: string;
  };
  condition?: string;
  distanceMeters?: number;
  duration?: string;
};

type RouteMetric = {
  distanceMeters: number;
  durationSeconds: number;
};

type ComputeRoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};

const routeMatrixFieldMask = "originIndex,destinationIndex,status,condition,distanceMeters,duration";
const computeRoutesFieldMask = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

export class GoogleRoutesConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleRoutesConfigurationError";
  }
}

export class GoogleRoutesProvider implements RouteComparisonProvider {
  private readonly apiKey?: string;
  private readonly fetcher: GoogleRoutesFetch;
  private readonly baseUrl: string;

  constructor(options: GoogleRoutesProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GOOGLE_MAPS_API_KEY;
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://routes.googleapis.com";
  }

  async compareDetour(request: SearchRequest, trip: Trip): Promise<RouteComparison> {
    const matrix = await this.computeRouteMatrix(request, trip);
    const baseline = this.requireMatrixMetric(matrix, 0, 2);
    const driverToPickup = this.requireMatrixMetric(matrix, 0, 0);
    const pickupToDropoff = this.requireMatrixMetric(matrix, 1, 1);
    const dropoffToDestination = this.requireMatrixMetric(matrix, 2, 2);
    const sharedDistanceMeters =
      driverToPickup.distanceMeters + pickupToDropoff.distanceMeters + dropoffToDestination.distanceMeters;
    const sharedDurationSeconds =
      driverToPickup.durationSeconds + pickupToDropoff.durationSeconds + dropoffToDestination.durationSeconds;

    return {
      baselineDistanceMeters: baseline.distanceMeters,
      baselineDurationSeconds: baseline.durationSeconds,
      detourDistanceMeters: Math.max(0, sharedDistanceMeters - baseline.distanceMeters),
      detourDurationSeconds: Math.max(0, sharedDurationSeconds - baseline.durationSeconds),
      pickupDistanceMeters: driverToPickup.distanceMeters,
      scheduleDeltaMinutes: scheduleDeltaMinutes(request, trip),
      driverToPickupDurationSeconds: driverToPickup.durationSeconds,
      pickupToDropoffDurationSeconds: pickupToDropoff.durationSeconds,
      dropoffToDestinationDurationSeconds: dropoffToDestination.durationSeconds,
    };
  }

  async completeRouteDetails(request: SearchRequest, trip: Trip, route: RouteComparison): Promise<RouteComparison> {
    const finalRoute = await this.computeFinalRoute(request, trip);
    return {
      ...route,
      finalDurationSeconds: finalRoute.durationSeconds,
      finalDistanceMeters: finalRoute.distanceMeters,
      finalEncodedPolyline: finalRoute.encodedPolyline,
    };
  }

  private async computeRouteMatrix(request: SearchRequest, trip: Trip): Promise<MatrixElement[]> {
    const departureTime = futureDepartureTime(request.desiredDepartureAt);
    const body = {
      origins: [matrixWaypoint(trip.origin), matrixWaypoint(request.origin), matrixWaypoint(request.destination)],
      destinations: [matrixWaypoint(request.origin), matrixWaypoint(request.destination), matrixWaypoint(trip.destination)],
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "METRIC",
      ...(departureTime ? { departureTime } : {}),
    };

    const response = await this.requestJson<MatrixElement[]>(
      "/distanceMatrix/v2:computeRouteMatrix",
      body,
      routeMatrixFieldMask,
    );

    if (!Array.isArray(response)) {
      throw new RouteUnavailableError("Google Route Matrix response was not an array.");
    }
    return response;
  }

  private async computeFinalRoute(
    request: SearchRequest,
    trip: Trip,
  ): Promise<RouteMetric & { encodedPolyline?: string }> {
    const departureTime = futureDepartureTime(request.desiredDepartureAt);
    const body = {
      origin: routeWaypoint(trip.origin),
      destination: routeWaypoint(trip.destination),
      ...finalRouteIntermediates(request, trip),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "METRIC",
      ...(departureTime ? { departureTime } : {}),
    };

    const response = await this.requestJson<ComputeRoutesResponse>(
      "/directions/v2:computeRoutes",
      body,
      computeRoutesFieldMask,
    );
    const route = response.routes?.[0];
    if (route?.distanceMeters == null || !route.duration) {
      throw new RouteUnavailableError("Google Compute Routes did not return a route.");
    }

    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: durationSeconds(route.duration),
      encodedPolyline: route.polyline?.encodedPolyline,
    };
  }

  private requireMatrixMetric(elements: MatrixElement[], originIndex: number, destinationIndex: number): RouteMetric {
    const element = elements.find((item) => item.originIndex === originIndex && item.destinationIndex === destinationIndex);
    if (!element) {
      throw new RouteUnavailableError(`Google Route Matrix missing element ${originIndex}:${destinationIndex}.`);
    }
    if (element.status?.code && element.status.code !== 0) {
      throw new RouteUnavailableError(element.status.message ?? `Google route ${originIndex}:${destinationIndex} failed.`);
    }
    if (element.condition && element.condition !== "ROUTE_EXISTS") {
      throw new RouteUnavailableError(`Google route ${originIndex}:${destinationIndex} condition ${element.condition}.`);
    }
    if (!element.duration) {
      throw new RouteUnavailableError(`Google route ${originIndex}:${destinationIndex} is incomplete.`);
    }
    const seconds = durationSeconds(element.duration);
    const distanceMeters = element.distanceMeters ?? (seconds === 0 ? 0 : undefined);
    if (distanceMeters == null) {
      throw new RouteUnavailableError(`Google route ${originIndex}:${destinationIndex} is incomplete.`);
    }

    return {
      distanceMeters,
      durationSeconds: seconds,
    };
  }

  private async requestJson<T>(path: string, body: unknown, fieldMask: string): Promise<T> {
    if (!this.apiKey) {
      throw new GoogleRoutesConfigurationError("GOOGLE_MAPS_API_KEY is required for Google Routes matching.");
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Google Routes request failed (${response.status} ${response.statusText}): ${details}`);
    }

    return (await response.json()) as T;
  }
}

function matrixWaypoint(point: LatLng) {
  return { waypoint: routeWaypoint(point) };
}

function routeWaypoint(point: LatLng) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  };
}

function finalRouteIntermediates(request: SearchRequest, trip: Trip) {
  const points = [request.origin, request.destination];
  const intermediates = points
    .filter((point) => !samePoint(point, trip.origin) && !samePoint(point, trip.destination))
    .filter((point, index, filtered) => index === 0 || !samePoint(point, filtered[index - 1]))
    .map(routeWaypoint);

  return intermediates.length > 0 ? { intermediates } : {};
}

function samePoint(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

function durationSeconds(duration: string): number {
  const match = duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) throw new RouteUnavailableError(`Unsupported Google duration: ${duration}`);
  return Math.round(Number(match[1]));
}

function futureDepartureTime(value: string): string | undefined {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || parsed <= Date.now()) return undefined;
  return new Date(parsed).toISOString();
}

function scheduleDeltaMinutes(request: SearchRequest, trip: Trip): number {
  return Math.round((new Date(trip.departureAt).getTime() - new Date(request.desiredDepartureAt).getTime()) / 60000);
}
