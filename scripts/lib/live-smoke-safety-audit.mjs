import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildSafetyAuditExport } from "./safety-audit-export.mjs";

export async function writeLiveSmokeSafetyAuditExport({
  admin,
  projectId,
  created,
  outputPath,
}) {
  const db = admin.firestore();
  const [rideSessions, liveTrips, childProfiles, rewardLedger] = await Promise.all([
    Promise.all(created.rideSessionIds.map((rideSessionId) => loadRideSessionForAudit(db, rideSessionId))),
    loadLiveTripsForAudit(admin, created.rideSessionIds),
    loadChildProfilesForAudit(db, created.childIds),
    loadRewardLedgerForAudit(db, created.rewardLedgerIds),
  ]);

  const releaseScopeNote = "Disposable live smoke export: proves guardian consent, pickup/dropoff, and native fallback telemetry for this run only. It does not close Radar provider, payment reconciliation, or physical real-device release gates.";
  const exportJson = {
    ...buildSafetyAuditExport({
      projectId,
      rideSessions,
      liveTrips,
      childProfiles,
      rewardLedger,
      reports: [],
    }),
    releaseScopeNote,
  };

  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(exportJson, null, 2)}\n`);

  return {
    outputPath,
    rideSessions: rideSessions.length,
    auditEvents: rideSessions.reduce((total, ride) => total + ride.auditEvents.length, 0),
    childProfiles: childProfiles.length,
    rewardLedger: rewardLedger.length,
    validateCommand: `npm run validate:safety-audit-export -- ${outputPath}`,
    releaseScopeNote,
  };
}

async function loadRideSessionForAudit(db, rideSessionId) {
  const rideRef = db.collection("rideSessions").doc(rideSessionId);
  const [rideSnap, auditSnap] = await Promise.all([
    rideRef.get(),
    rideRef.collection("auditEvents").orderBy("recordedAt", "asc").limit(100).get(),
  ]);
  return {
    id: rideSessionId,
    data: rideSnap.data() ?? {},
    auditEvents: auditSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
  };
}

async function loadLiveTripsForAudit(admin, rideSessionIds) {
  const entries = await Promise.all(rideSessionIds.map(async (rideSessionId) => {
    const snapshot = await admin.database().ref(`liveTrips/${rideSessionId}`).get();
    return [rideSessionId, snapshot.val()];
  }));
  return Object.fromEntries(entries.filter(([, value]) => value));
}

async function loadChildProfilesForAudit(db, childIds) {
  const snapshots = await Promise.all(childIds.map((childId) => db.collection("children").doc(childId).get()));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} }));
}

async function loadRewardLedgerForAudit(db, rewardLedgerIds) {
  const snapshots = await Promise.all(rewardLedgerIds.map((id) => db.collection("rewardLedger").doc(id).get()));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} }));
}
