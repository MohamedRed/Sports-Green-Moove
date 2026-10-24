#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import admin from "firebase-admin";
import { buildSafetyAuditExport } from "./lib/safety-audit-export.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  await main(options);
} finally {
  await Promise.all(admin.apps.filter(Boolean).map((app) => app.delete()));
}

async function main({
  projectId,
  databaseUrl,
  outputPath,
  rideSessionIds,
  bookingIds,
  reportIds,
}) {
  if (rideSessionIds.length === 0) {
    fail("At least one --ride-session-id value is required.");
  }

  admin.initializeApp({ projectId, databaseURL: databaseUrl });
  const db = admin.firestore();

  const rideSessions = await Promise.all(
    rideSessionIds.map((rideSessionId) => loadRideSession(db, rideSessionId)),
  );
  const rideBookingIds = rideSessions.flatMap((ride) => ride.data.bookingIds ?? []);
  const rideChildIds = rideSessions.flatMap((ride) => [
    ...(ride.data.childUserIds ?? []),
    ...(ride.data.passengers ?? []).map((passenger) => passenger.childId).filter(Boolean),
  ]);
  const allBookingIds = unique([...bookingIds, ...rideBookingIds]);

  const [liveTrips, childProfiles, rewardLedger, reports] = await Promise.all([
    loadLiveTrips(rideSessionIds),
    loadChildProfiles(db, unique(rideChildIds)),
    loadRewardLedgerForBookings(db, allBookingIds),
    loadReports(db, reportIds),
  ]);

  const exportJson = buildSafetyAuditExport({
    projectId,
    rideSessions,
    liveTrips,
    childProfiles,
    rewardLedger,
    reports,
  });

  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(exportJson, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    outputPath,
    rideSessions: rideSessions.length,
    auditEvents: rideSessions.reduce((total, ride) => total + ride.auditEvents.length, 0),
    childProfiles: childProfiles.length,
    rewardLedger: rewardLedger.length,
    reports: reports.length,
    validateCommand: `npm run validate:safety-audit-export -- ${outputPath}`,
  }, null, 2));
}

async function loadRideSession(db, rideSessionId) {
  const rideRef = db.collection("rideSessions").doc(rideSessionId);
  const [rideSnap, auditSnap] = await Promise.all([
    rideRef.get(),
    rideRef.collection("auditEvents").orderBy("recordedAt", "asc").limit(100).get(),
  ]);
  if (!rideSnap.exists) fail(`rideSessions/${rideSessionId} does not exist.`);
  return {
    id: rideSnap.id,
    data: rideSnap.data() ?? {},
    auditEvents: auditSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
  };
}

async function loadLiveTrips(rideSessionIds) {
  const entries = await Promise.all(
    rideSessionIds.map(async (rideSessionId) => {
      const snapshot = await admin.database().ref(`liveTrips/${rideSessionId}`).get();
      return [rideSessionId, snapshot.val()];
    }),
  );
  return Object.fromEntries(entries.filter(([, value]) => value));
}

async function loadChildProfiles(db, childIds) {
  const snapshots = await Promise.all(childIds.map((childId) => db.collection("children").doc(childId).get()));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} }));
}

async function loadRewardLedgerForBookings(db, bookingIds) {
  const chunks = chunk(bookingIds, 10);
  const snapshots = await Promise.all(
    chunks.map((ids) => db.collection("rewardLedger").where("bookingId", "in", ids).limit(100).get()),
  );
  return snapshots.flatMap((snapshot) => {
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  });
}

async function loadReports(db, reportIds) {
  const snapshots = await Promise.all(reportIds.map((reportId) => {
    const id = reportId.startsWith("reports/") ? reportId.slice("reports/".length) : reportId;
    return db.collection("reports").doc(id).get();
  }));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} }));
}

function parseArgs(args) {
  const options = {
    projectId: process.env.SGM_FIREBASE_PROJECT_ID ?? "sports-green-moove-prod",
    databaseUrl: process.env.SGM_FIREBASE_DATABASE_URL
      ?? "https://sports-green-moove-prod-default-rtdb.europe-west1.firebasedatabase.app",
    outputPath: "docs/release/evidence/safety-audit-export.json",
    rideSessionIds: [],
    bookingIds: [],
    reportIds: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") usage();
    if (arg === "--project-id") options.projectId = requireValue(args, index += 1, arg);
    else if (arg === "--database-url") options.databaseUrl = requireValue(args, index += 1, arg);
    else if (arg === "--output") options.outputPath = requireValue(args, index += 1, arg);
    else if (arg === "--ride-session-id") options.rideSessionIds.push(...splitIds(requireValue(args, index += 1, arg)));
    else if (arg === "--booking-id") options.bookingIds.push(...splitIds(requireValue(args, index += 1, arg)));
    else if (arg === "--report-id") options.reportIds.push(...splitIds(requireValue(args, index += 1, arg)));
    else fail(`Unknown argument: ${arg}`);
  }

  return {
    ...options,
    rideSessionIds: unique(options.rideSessionIds),
    bookingIds: unique(options.bookingIds),
    reportIds: unique(options.reportIds),
  };
}

function usage() {
  console.log(`Usage:
  npm run export:safety-audit-evidence -- --ride-session-id RIDES_SESSION_ID [options]

Options:
  --booking-id ID          Include reward-ledger payment records for this booking. Repeatable.
  --report-id ID           Include reports/ID reconciliation records. Repeatable.
  --output PATH            Output path. Defaults to docs/release/evidence/safety-audit-export.json.
  --project-id ID          Firebase project id. Defaults to SGM_FIREBASE_PROJECT_ID or production.
  --database-url URL       Firebase RTDB URL. Defaults to SGM_FIREBASE_DATABASE_URL or production.
`);
  process.exit(0);
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) fail(`${flag} requires a value.`);
  return value;
}

function splitIds(value) {
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
