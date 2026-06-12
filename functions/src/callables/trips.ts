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
import type { ClientSearchMatch, SearchRequest, Trip } from "../domain/types.js";
import { GoogleRoutesProvider } from "../services/googleRoutes.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { toClientTripSummary } from "../lib/clientTrips.js";

const latLngSchema = z.object({
  lat: z.number(),
  lng: z.number(),
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
  title: z.string().optional(),
  sport: z.string().optional(),
  clubName: z.string().optional(),
  teamName: z.string().optional(),
  clubId: z.string().optional(),
  teamId: z.string().optional(),
  category: z.string().optional(),
  departureAt: z.string().optional(),
  arrivalBy: z.string().optional(),
  origin: latLngSchema.optional(),
  destination: latLngSchema.optional(),
  pickupRadiusM: z.number().int().positive().optional(),
  seatsTotal: z.number().int().positive().optional(),
  seatsAvailable: z.number().int().positive().optional(),
  baggage: z.enum(["small", "medium", "large"]).optional(),
  returnTrip: z.boolean().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  driverRating: z.number().min(0).max(5).optional(),
  driverVerified: z.boolean().optional(),
  supportsVehicleTracking: z.boolean().optional(),
  supportsChildTracking: z.boolean().optional(),
  co2SavedKgEstimate: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  passengerInitials: z.array(z.string()).optional(),
  regionGeohash: z.string().optional(),
  blockedUserIds: z.array(z.string()).optional(),
});

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

export const searchTrips = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const parsed = searchTripsSchema.parse(request.data);
  const searchRequest = await loadSearchRequest(uid, parsed);

  const candidates = await loadCandidateTrips(searchRequest);
  const ranked = await rankTrips(searchRequest, candidates, new GoogleRoutesProvider(), { finalRouteLimit: 12 });

  return {
    matches: ranked.slice(0, 12).map((match): ClientSearchMatch => ({
      tripId: match.trip.id,
      score: match.score,
      route: match.route,
      reasons: match.reasons,
      summary: toClientTripSummary(match.trip),
    })),
  };
});

export const createTrip = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const data = createTripSchema.parse(request.data ?? {});
  const ref = firestore.collection("trips").doc();
  const trip: Trip = {
    id: ref.id,
    driverUserId: uid,
    status: "published",
    title: data.title,
    sport: data.sport,
    clubName: data.clubName,
    teamName: data.teamName,
    clubId: data.clubId ?? "",
    teamId: data.teamId ?? "",
    category: data.category ?? "",
    departureAt: data.departureAt ?? new Date().toISOString(),
    arrivalBy: data.arrivalBy,
    origin: data.origin ?? { lat: 0, lng: 0 },
    destination: data.destination ?? { lat: 0, lng: 0 },
    pickupRadiusM: data.pickupRadiusM ?? 1500,
    seatsTotal: data.seatsTotal ?? data.seatsAvailable ?? 1,
    seatsAvailable: data.seatsAvailable ?? 1,
    baggage: data.baggage ?? "medium",
    returnTrip: data.returnTrip ?? false,
    priceCents: data.priceCents ?? 0,
    driverRating: data.driverRating ?? 5,
    driverVerified: data.driverVerified ?? false,
    supportsVehicleTracking: data.supportsVehicleTracking ?? true,
    supportsChildTracking: data.supportsChildTracking ?? false,
    co2SavedKgEstimate: data.co2SavedKgEstimate ?? 0,
    distanceKm: data.distanceKm,
    passengerInitials: data.passengerInitials ?? [],
    regionGeohash: data.regionGeohash,
    blockedUserIds: data.blockedUserIds ?? [],
  };

  await ref.set({
    ...trip,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { tripId: ref.id, trip: toClientTripSummary(trip) };
});
