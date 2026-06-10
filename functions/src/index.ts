import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { estimateCo2SavedKg } from "./domain/co2.js";
import { rankTrips } from "./domain/matching.js";
import { rewardForCo2Saved } from "./domain/rewards.js";
import type { LocationUpdate, SearchRequest, Trip } from "./domain/types.js";
import { GoogleRoutesProvider } from "./services/googleRoutes.js";
import { radarEventToLocationUpdate, verifyRadarSignature } from "./services/radar.js";
import { createConnectedAccount, createStripeClient, platformFeeAmountCents } from "./services/stripeConnect.js";

initializeApp();

const firestore = getFirestore();
const realtimeDb = getDatabase();

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
});

const locationUpdateSchema = z.object({
  rideSessionId: z.string(),
  userId: z.string(),
  role: z.enum(["driver", "child"]),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nonnegative(),
  speedMps: z.number().optional(),
  headingDeg: z.number().optional(),
  batteryPct: z.number().optional(),
  capturedAt: z.number(),
  uploadedAt: z.number().optional(),
  source: z.enum(["radar", "nativeFallback", "manual"]),
});

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

async function writeLiveLocation(update: LocationUpdate): Promise<void> {
  const path = `liveTrips/${update.rideSessionId}/${update.role}/${update.userId}`;
  await realtimeDb.ref(path).set({
    ...update,
    uploadedAt: update.uploadedAt || Date.now(),
  });
}

async function loadCandidateTrips(request: SearchRequest): Promise<Trip[]> {
  let query = firestore.collection("trips").where("status", "==", "published");
  if (request.clubId) query = query.where("clubId", "==", request.clubId);
  if (request.category) query = query.where("category", "==", request.category);

  const snapshot = await query.limit(50).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Trip);
}

export const searchTrips = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const parsed = searchTripsSchema.parse(request.data);
  const searchRequest: SearchRequest = {
    ...parsed,
    requesterUserId: parsed.requesterUserId ?? uid,
  };

  const candidates = await loadCandidateTrips(searchRequest);
  const ranked = await rankTrips(searchRequest, candidates, new GoogleRoutesProvider());

  return {
    matches: ranked.slice(0, 12).map((match) => ({
      tripId: match.trip.id,
      score: match.score,
      route: match.route,
      reasons: match.reasons,
      trip: match.trip,
    })),
  };
});

export const createTrip = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = request.data as Partial<Trip>;
  const ref = firestore.collection("trips").doc();
  const trip: Trip = {
    id: ref.id,
    driverUserId: uid,
    status: "published",
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
    blockedUserIds: data.blockedUserIds ?? [],
  };

  await ref.set({
    ...trip,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { tripId: ref.id };
});

export const requestBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    tripId: z.string(),
    childId: z.string().optional(),
    seats: z.number().int().positive().default(1),
    note: z.string().optional(),
  });
  const data = schema.parse(request.data);
  const ref = firestore.collection("bookings").doc();

  await ref.set({
    tripId: data.tripId,
    requesterUserId: uid,
    childId: data.childId,
    seats: data.seats,
    note: data.note,
    status: "requested",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { bookingId: ref.id };
});

export const approveBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    bookingId: z.string(),
  });
  const data = schema.parse(request.data);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  await firestore.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as { tripId: string; seats?: number; status?: string };
    if (booking.status !== "requested") throw new HttpsError("failed-precondition", "Booking is not pending.");

    const tripRef = firestore.collection("trips").doc(booking.tripId);
    const tripSnap = await transaction.get(tripRef);
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = tripSnap.data() as Trip;
    if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can approve.");
    if (trip.seatsAvailable < (booking.seats ?? 1)) {
      throw new HttpsError("failed-precondition", "Not enough seats available.");
    }

    transaction.update(bookingRef, {
      status: "approved",
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    transaction.update(tripRef, {
      seatsAvailable: FieldValue.increment(-(booking.seats ?? 1)),
      updatedAt: Timestamp.now(),
    });
  });

  return { bookingId: data.bookingId, status: "approved" };
});

export const startRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    tripId: z.string(),
    bookingIds: z.array(z.string()).default([]),
  });
  const data = schema.parse(request.data);
  const ref = firestore.collection("rideSessions").doc();

  await ref.set({
    tripId: data.tripId,
    bookingIds: data.bookingIds,
    driverUserId: uid,
    status: "active",
    startedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  });

  await realtimeDb.ref(`liveTrips/${ref.id}/meta`).set({
    tripId: data.tripId,
    status: "active",
    startedAt: Date.now(),
  });

  return { rideSessionId: ref.id };
});

export const endRide = onCall(async (request) => {
  requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    distanceMeters: z.number().nonnegative().default(0),
    passengersSharing: z.number().int().nonnegative().default(1),
  });
  const data = schema.parse(request.data);
  const co2SavedKg = estimateCo2SavedKg(data.distanceMeters, data.passengersSharing);
  const rewardCents = rewardForCo2Saved(co2SavedKg);

  await firestore.collection("rideSessions").doc(data.rideSessionId).set(
    {
      status: "completed",
      completedAt: Timestamp.now(),
      co2SavedKg,
      rewardCents,
    },
    { merge: true },
  );
  await realtimeDb.ref(`liveTrips/${data.rideSessionId}/meta`).update({
    status: "completed",
    completedAt: Date.now(),
  });

  return { rideSessionId: data.rideSessionId, co2SavedKg, rewardCents };
});

export const writeLocationBatch = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    updates: z.array(locationUpdateSchema).min(1).max(100),
  });
  const data = schema.parse(request.data);

  for (const update of data.updates) {
    await writeLiveLocation({
      ...update,
      userId: update.userId || uid,
      uploadedAt: update.uploadedAt ?? Date.now(),
      source: "nativeFallback",
    });
  }

  return { written: data.updates.length };
});

export const createStripeAccount = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    email: z.string().email(),
  });
  const data = schema.parse(request.data);
  const account = await createConnectedAccount({ email: data.email, country: "BE", userId: uid });

  await firestore.collection("stripeAccounts").doc(uid).set(
    {
      stripeAccountId: account.id,
      accountVersion: "v2",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return account;
});

export const createRidePaymentIntent = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    bookingId: z.string(),
    amountCents: z.number().int().positive(),
    currency: z.literal("eur").default("eur"),
    destinationStripeAccountId: z.string().optional(),
  });
  const data = schema.parse(request.data);
  const stripe = createStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: data.amountCents,
    currency: data.currency,
    automatic_payment_methods: { enabled: true },
    application_fee_amount: platformFeeAmountCents(data.amountCents),
    transfer_data: data.destinationStripeAccountId ? { destination: data.destinationStripeAccountId } : undefined,
    metadata: {
      bookingId: data.bookingId,
      payerUserId: uid,
      product: "sports-green-moove",
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
});

export const radarWebhook = onRequest(async (req, res) => {
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const signature = req.header("x-radar-signature") ?? req.header("radar-signature");
  if (!verifyRadarSignature(rawBody, signature)) {
    res.status(401).send("invalid signature");
    return;
  }

  const update = radarEventToLocationUpdate(req.body);
  if (update) {
    await writeLiveLocation(update);
  }

  res.status(204).send();
});

export const stripeWebhook = onRequest(async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.header("stripe-signature");
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  if (!secret || !signature) {
    res.status(400).send("missing signature");
    return;
  }

  try {
    const stripe = createStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    await firestore.collection("reports").add({
      type: "stripeWebhook",
      eventId: event.id,
      eventType: event.type,
      createdAt: Timestamp.now(),
    });

    res.status(204).send();
  } catch (error) {
    logger.error("Stripe webhook failed", error);
    res.status(400).send("webhook error");
  }
});
