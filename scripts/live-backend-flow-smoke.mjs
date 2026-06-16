import { randomUUID } from "node:crypto";
import process from "node:process";
import admin from "firebase-admin";
import { seedChildProfile, verifyNativeFallbackTracking } from "./live-backend-child-tracking.mjs";
import { androidApiKey } from "./firebase-android-config.mjs";

const projectId = process.env.SGM_FIREBASE_PROJECT_ID ?? "sports-green-moove-prod";
const region = process.env.SGM_FIREBASE_FUNCTIONS_REGION ?? "us-central1";
const functionBaseUrl = `https://${region}-${projectId}.cloudfunctions.net`;
const runId = `codex-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;

const created = {
  authUserIds: [],
  userDocIds: [],
  childIds: [],
  tripIds: [],
  bookingIds: [],
  rideSessionIds: [],
  messageIds: [],
  notificationIds: [],
  ratingIds: [],
  co2LedgerIds: [],
  rewardLedgerIds: [],
};

async function authRest(method, apiKey, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${method}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} failed: ${JSON.stringify(result)}`);
  return result;
}

async function createSession(label, roleKeys, apiKey) {
  const email = `${runId}-${label}@example.invalid`;
  const password = `Sgm-${randomUUID()}-Aa1!`;
  const user = await authRest("accounts:signUp", apiKey, {
    email,
    password,
    returnSecureToken: true,
  });
  const uid = user.localId;
  created.authUserIds.push(uid);
  created.userDocIds.push(uid);

  await admin.auth().updateUser(uid, { displayName: `Codex ${label}`, emailVerified: true });
  await admin.auth().setCustomUserClaims(uid, { roleKeys });
  const signedIn = await authRest("accounts:signInWithPassword", apiKey, {
    email,
    password,
    returnSecureToken: true,
  });
  return { uid, idToken: signedIn.idToken, roleKeys };
}

async function callFunction(name, idToken, data = {}) {
  const response = await fetch(`${functionBaseUrl}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${name} failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTrip(driver) {
  const departureAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
  const arrivalBy = new Date(Date.now() + 38 * 60 * 60 * 1000).toISOString();
  const result = await callFunction("createTrip", driver.idToken, {
    title: `${runId} Waterloo training`,
    sport: "Football",
    clubName: "Codex Smoke Club",
    teamName: "U14",
    clubId: `${runId}-club`,
    teamId: `${runId}-team`,
    category: "U14",
    departureAt,
    arrivalBy,
    origin: { lat: 50.85034, lng: 4.35171 },
    destination: { lat: 50.66961, lng: 4.61221 },
    pickupRadiusM: 1200,
    seatsTotal: 3,
    seatsAvailable: 2,
    baggage: "small",
    returnTrip: false,
    priceCents: 0,
    supportsVehicleTracking: true,
    supportsChildTracking: true,
    co2SavedKgEstimate: 4.2,
    distanceKm: 28.4,
    passengerInitials: [],
    regionGeohash: "u151",
  });
  created.tripIds.push(result.tripId);
  return { tripId: result.tripId, departureAt };
}

async function searchCreatedTrip(parent, trip, childId) {
  const result = await callFunction("searchTrips", parent.idToken, {
    childUserId: childId,
    desiredDepartureAt: trip.departureAt,
    origin: { lat: 50.84673, lng: 4.35247 },
    destination: { lat: 50.66961, lng: 4.61221 },
    seatsNeeded: 1,
    baggage: "small",
    returnTrip: false,
    requireChildTracking: true,
    guardianConsent: true,
    clubId: `${runId}-club`,
    teamId: `${runId}-team`,
    maxDetourMinutes: 45,
    maxPickupDistanceM: 3000,
    departureWindowBeforeMinutes: 90,
    departureWindowAfterMinutes: 90,
  });
  assert(
    Array.isArray(result.matches) && result.matches.some((match) => match.tripId === trip.tripId),
    "searchTrips did not return the disposable trip.",
  );
  return result.matches.length;
}

async function requestAndApproveBooking(parent, driver, tripId, childId) {
  const request = await callFunction("requestBooking", parent.idToken, { tripId, childId, seats: 1, note: runId });
  created.bookingIds.push(request.bookingId);

  const queue = await callFunction("listDriverBookingRequests", driver.idToken);
  assert(
    Array.isArray(queue.bookings) && queue.bookings.some((booking) => booking.bookingId === request.bookingId),
    "Driver queue did not include the requested booking.",
  );

  const approval = await callFunction("approveBooking", driver.idToken, { bookingId: request.bookingId });
  assert(approval.status === "approved", "approveBooking did not approve the booking.");
  return request.bookingId;
}

async function runRideFlow(parent, driver, child, tripId, bookingId) {
  const chat = await callFunction("sendChatMessage", parent.idToken, { bookingId, body: `Smoke chat ${runId}` });
  created.messageIds.push(chat.messageId);

  const started = await callFunction("startRide", driver.idToken, { tripId, bookingIds: [bookingId] });
  const rideSessionId = started.ride?.rideSessionId;
  assert(rideSessionId, "startRide did not return a ride session id.");
  created.rideSessionIds.push(rideSessionId);

  await verifyNativeFallbackTracking({ admin, callFunction, assert, parent, driver, child, rideSessionId });

  await callFunction("markPickup", driver.idToken, { rideSessionId, bookingId, childId: child.uid, note: runId });
  await callFunction("markDropoff", driver.idToken, { rideSessionId, bookingId, childId: child.uid, note: runId });

  const completed = await callFunction("endRide", driver.idToken, {
    rideSessionId,
    distanceMeters: 12_000,
    passengersSharing: 2,
  });
  assert(completed.rideSessionId === rideSessionId, "endRide did not complete the expected ride.");

  const rating = await callFunction("submitRating", parent.idToken, {
    rideSessionId,
    ratedUserId: driver.uid,
    score: 5,
    comment: runId,
  });
  created.ratingIds.push(rating.ratingId);

  created.co2LedgerIds.push(`rideCompletion_${encodeURIComponent(rideSessionId)}`);
  if (completed.rewardCents > 0) {
    created.rewardLedgerIds.push(`co2Bonus_${encodeURIComponent(rideSessionId)}_${encodeURIComponent(driver.uid)}`);
  }
  return rideSessionId;
}

async function collectCleanupIds() {
  const db = admin.firestore();
  for (const uid of created.authUserIds) {
    const notifications = await db.collection("notifications").where("userId", "==", uid).get();
    created.notificationIds.push(...notifications.docs.map((doc) => doc.id));
  }
}

async function cleanup() {
  const db = admin.firestore();
  await collectCleanupIds();
  await Promise.all([
    ...created.messageIds.map((id) => db.collection("messages").doc(id).delete().catch(() => undefined)),
    ...created.ratingIds.map((id) => db.collection("ratings").doc(id).delete().catch(() => undefined)),
    ...created.notificationIds.map((id) => db.collection("notifications").doc(id).delete().catch(() => undefined)),
    ...created.co2LedgerIds.map((id) => db.collection("co2Ledger").doc(id).delete().catch(() => undefined)),
    ...created.rewardLedgerIds.map((id) => db.collection("rewardLedger").doc(id).delete().catch(() => undefined)),
    ...created.childIds.map((id) => db.collection("children").doc(id).delete().catch(() => undefined)),
    ...created.bookingIds.map((id) => db.collection("bookings").doc(id).delete().catch(() => undefined)),
    ...created.tripIds.map((id) => db.collection("trips").doc(id).delete().catch(() => undefined)),
    ...created.rideSessionIds.map((id) => db.collection("rideSessions").doc(id).delete().catch(() => undefined)),
    ...created.rideSessionIds.map((id) => admin.database().ref(`liveTrips/${id}`).remove().catch(() => undefined)),
    ...created.userDocIds.map((id) => db.collection("users").doc(id).delete().catch(() => undefined)),
  ]);
  if (created.authUserIds.length) {
    await admin.auth().deleteUsers(created.authUserIds).catch(() => undefined);
  }
}

async function main() {
  admin.initializeApp({
    projectId,
    databaseURL: `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app`,
  });

  const apiKey = await androidApiKey(projectId);
  const driver = await createSession("driver", ["driver"], apiKey);
  const parent = await createSession("parent", ["parent"], apiKey);
  const child = await createSession("child", ["child"], apiKey);
  await Promise.all([
    callFunction("initializeUserProfile", driver.idToken, { displayName: "Codex Driver" }),
    callFunction("initializeUserProfile", parent.idToken, { displayName: "Codex Parent" }),
    callFunction("initializeUserProfile", child.idToken, { displayName: "Codex Child" }),
  ]);
  await admin.firestore().collection("users").doc(driver.uid).set({
    driverVerified: true,
    driverRating: 4.8,
  }, { merge: true });

  const childId = await seedChildProfile({ admin, runId, parent, child, created });
  const trip = await createTrip(driver);
  const matchCount = await searchCreatedTrip(parent, trip, childId);
  const bookingId = await requestAndApproveBooking(parent, driver, trip.tripId, childId);
  const rideSessionId = await runRideFlow(parent, driver, child, trip.tripId, bookingId);

  console.log(JSON.stringify({
    ok: true,
    projectId,
    runId,
    verified: {
      authProfiles: 3,
      publishedTrip: trip.tripId,
      searchMatches: matchCount,
      approvedBooking: bookingId,
      completedRide: rideSessionId,
      childNativeFallback: child.uid,
      chatMessages: created.messageIds.length,
      ratings: created.ratingIds.length,
    },
  }, null, 2));
}

try {
  await main();
} finally {
  await cleanup();
  await Promise.all(admin.apps.filter(Boolean).map((app) => app.delete()));
}
