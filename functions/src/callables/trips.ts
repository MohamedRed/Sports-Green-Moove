import { Timestamp, type Query } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { departureWindowForSearch } from "../domain/candidateFilters.js";
import { rankTrips } from "../domain/matching.js";
import {
  applySearchAccessScope,
  isGuardianOfChild,
  requestedScopeIsAllowed,
  searchAccessScope,
} from "../domain/searchAccess.js";
import { buildPublishedTrip, createTripSeatsAreValid, driverPublishState } from "../domain/publishTrip.js";
import type { ClientSearchMatch, SearchRequest, Trip } from "../domain/types.js";
import { GoogleRoutesProvider } from "../services/googleRoutes.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { googleMapsApiKeySecret } from "../lib/providerSecrets.js";
import { toClientMapRoutePreview, toClientTripSummary } from "../lib/clientTrips.js";

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const searchTripsSchema = z.object({
  requesterUserId: z.string().optional(),
  childUserId: z.string().optional(),
  clubId: z.string().optional(),
  teamId: z.string().optional(),
  category: z.string().optional(),
  desiredDepartureAt: z.string(),
  origin: latLngSchema,
  destination: latLngSchema,
  seatsNeeded: z.number().int().positive(),
  baggage: z.enum(["small", "medium", "large"]),
  returnTrip: z.boolean(),
  requireChildTracking: z.boolean(),
  guardianConsent: z.boolean(),
  maxDetourMinutes: z.number().positive().optional(),
  maxPickupDistanceM: z.number().positive().optional(),
  departureWindowBeforeMinutes: z.number().int().positive().max(24 * 60).optional(),
  departureWindowAfterMinutes: z.number().int().positive().max(24 * 60).optional(),
  regionGeohashPrefixes: z.array(z.string().min(1).max(12)).max(9).optional(),
});

const createTripSchema = z.object({
  title: z.string().trim().min(2).max(140),
  sport: z.string().trim().min(2).max(40),
  clubName: z.string().trim().min(2).max(120),
  teamName: z.string().trim().min(1).max(120).optional(),
  clubId: z.string().trim().min(1).max(120),
  teamId: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  departureAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "departureAt must be a valid ISO date."),
  arrivalBy: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "arrivalBy must be a valid ISO date.").optional(),
  origin: latLngSchema,
  destination: latLngSchema,
  pickupRadiusM: z.number().int().min(100).max(10_000),
  seatsTotal: z.number().int().positive().max(8),
  seatsAvailable: z.number().int().positive().max(8),
  baggage: z.enum(["small", "medium", "large"]),
  returnTrip: z.boolean(),
  priceCents: z.number().int().nonnegative().max(100_000),
  supportsVehicleTracking: z.boolean(),
  supportsChildTracking: z.boolean(),
  co2SavedKgEstimate: z.number().nonnegative().max(500),
  distanceKm: z.number().nonnegative().optional(),
  passengerInitials: z.array(z.string()).optional(),
  regionGeohash: z.string().optional(),
  blockedUserIds: z.array(z.string()).optional(),
}).strict();

async function loadCandidateTrips(request: SearchRequest): Promise<Trip[]> {
  const window = departureWindowForSearch(request);
  if (!window.fromIso || !window.toIso) {
    throw new HttpsError("invalid-argument", "desiredDepartureAt must be a valid ISO date.");
  }

  let query: Query = firestore
    .collection("trips")
    .where("status", "==", "published")
    .where("departureAt", ">=", window.fromIso)
    .where("departureAt", "<=", window.toIso)
    .orderBy("departureAt", "asc");

  const snapshot = await query.limit(100).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Trip);
}

async function loadSearchRequest(uid: string, parsed: z.infer<typeof searchTripsSchema>): Promise<SearchRequest> {
  const baseRequest: SearchRequest = {
    ...parsed,
    requesterUserId: uid,
  };

  const childSnapshot = parsed.childUserId
    ? await firestore.collection("children").doc(parsed.childUserId).get()
    : undefined;
  const child = childSnapshot?.data();

  if (parsed.childUserId && (!childSnapshot?.exists || !isGuardianOfChild(child, uid))) {
    throw new HttpsError("permission-denied", "Only a guardian can search trips for this child.");
  }

  const memberships = await loadMemberships(uid, parsed.childUserId);
  const requestWithScope = applySearchAccessScope(baseRequest, searchAccessScope(memberships, child));

  if (requestWithScope.enforceMemberships && !requestedScopeIsAllowed(requestWithScope)) {
    throw new HttpsError("permission-denied", "The requested club or team is not available for this child.");
  }

  return requestWithScope;
}

async function loadMemberships(uid: string, childUserId?: string): Promise<Array<Record<string, unknown>>> {
  const queries = [
    firestore.collection("memberships").where("userId", "==", uid).limit(50).get(),
  ];

  if (childUserId) {
    queries.push(firestore.collection("memberships").where("userId", "==", childUserId).limit(50).get());
    queries.push(firestore.collection("memberships").where("childUserId", "==", childUserId).limit(50).get());
  }

  const snapshots = await Promise.all(queries);
  return snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data()));
}

export const listTrips = onCall(async (request) => {
  requireAuth(request.auth?.uid);

  const snapshot = await firestore
    .collection("trips")
    .where("status", "==", "published")
    .orderBy("departureAt", "asc")
    .limit(30)
    .get();

  return {
    trips: snapshot.docs.map((doc) => toClientTripSummary({ id: doc.id, ...doc.data() } as Trip)),
  };
});

export const searchTrips = onCall({ secrets: [googleMapsApiKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const parsed = searchTripsSchema.parse(request.data);
  const searchRequest = await loadSearchRequest(uid, parsed);

  const candidates = await loadCandidateTrips(searchRequest);
  const ranked = await rankTrips(
    searchRequest,
    candidates,
    new GoogleRoutesProvider({ apiKey: googleMapsApiKeySecret.value() }),
    { finalRouteLimit: 12 },
  );

  return {
    matches: ranked.slice(0, 12).map((match): ClientSearchMatch => ({
      tripId: match.trip.id,
      score: match.score,
      route: match.route,
      reasons: match.reasons,
      summary: {
        ...toClientTripSummary(match.trip),
        mapPreview: toClientMapRoutePreview(match.trip, match.route.finalEncodedPolyline),
      },
    })),
  };
});

export const createTrip = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const data = createTripSchema.parse(request.data ?? {});
  if (!createTripSeatsAreValid(data)) {
    throw new HttpsError("invalid-argument", "Available seats cannot exceed total seats.");
  }

  const profile = (await firestore.collection("users").doc(uid).get()).data();
  const driver = driverPublishState(profile);
  if (!driver.driverVerified) {
    throw new HttpsError("failed-precondition", "Driver verification is required before publishing trips.");
  }

  const ref = firestore.collection("trips").doc();
  const trip: Trip = buildPublishedTrip(ref.id, uid, data, driver);

  await ref.set({
    ...trip,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { tripId: ref.id, trip: toClientTripSummary(trip) };
});
