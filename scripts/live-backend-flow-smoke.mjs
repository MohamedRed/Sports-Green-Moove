import { randomUUID } from "node:crypto";
import process from "node:process";
import admin from "firebase-admin";
import { seedChildProfile, verifyNativeFallbackTracking } from "./live-backend-child-tracking.mjs";
import { androidApiKey } from "./firebase-android-config.mjs";
import { writeLiveSmokeSafetyAuditExport } from "./lib/live-smoke-safety-audit.mjs";
import { cleanupLiveSmoke, runWithSmokeCleanup } from "./lib/live-smoke-cleanup.mjs";

const projectId = process.env.SGM_FIREBASE_PROJECT_ID ?? "sports-green-moove-prod";
const region = process.env.SGM_FIREBASE_FUNCTIONS_REGION ?? "us-central1";
const functionBaseUrl = `https://${region}-${projectId}.cloudfunctions.net`;
const options = parseArgs(process.argv.slice(2));
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
  return { matchCount: result.matches.length, displayed: result.matches.find((match) => match.tripId === trip.tripId).summary };
}

async function requestAndApproveBooking(parent, driver, tripId, childId, displayed) {
  const request = await callFunction("requestBooking", parent.idToken, { tripId, childId, seats: 1,
    expectedBookingIntent: displayed.bookingIntent, note: runId });
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

  created.co2LedgerIds.push(`rideCompletion_${encodeURIComponent(rideSessionId)}`);
  created.rewardLedgerIds.push(`co2Bonus_${encodeURIComponent(rideSessionId)}_${encodeURIComponent(driver.uid)}`);
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

  return rideSessionId;
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
  const { matchCount, displayed } = await searchCreatedTrip(parent, trip, childId);
  const bookingId = await requestAndApproveBooking(parent, driver, trip.tripId, childId, displayed);
  const rideSessionId = await runRideFlow(parent, driver, child, trip.tripId, bookingId);
  const safetyAuditExport = options.safetyAuditOutput
    ? await writeLiveSmokeSafetyAuditExport({ admin, projectId, created, outputPath: options.safetyAuditOutput })
    : undefined;

  return {
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
    safetyAuditExport,
  };
}

function parseArgs(args) {
  const options = { safetyAuditOutput: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") usage();
    if (arg === "--safety-audit-output") options.safetyAuditOutput = requireValue(args, index += 1, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  console.log(`Usage:
  npm run smoke:live-backend-flow -- [options]

Options:
  --safety-audit-output PATH  Write a sanitized disposable safety-audit export before cleanup.
`);
  process.exit(0);
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

const result = await runWithSmokeCleanup({
  run: main,
  cleanup: () => cleanupLiveSmoke({ admin, created }),
  dispose: () => Promise.all(admin.apps.filter(Boolean).map((app) => app.delete())),
});
console.log(JSON.stringify({ ...result, cleanup: "complete" }, null, 2));
