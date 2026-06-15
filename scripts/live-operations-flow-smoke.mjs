import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import admin from "firebase-admin";

const projectId = process.env.SGM_FIREBASE_PROJECT_ID ?? "sports-green-moove-prod";
const region = process.env.SGM_FIREBASE_FUNCTIONS_REGION ?? "us-central1";
const functionBaseUrl = `https://${region}-${projectId}.cloudfunctions.net`;
const runId = `codex-ops-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const created = {
  authUserIds: [],
  userDocIds: [],
  clubIds: [],
  membershipIds: [],
  reportIds: [],
};

function parseFirebaseJson(output) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Firebase CLI did not return JSON.");
  return JSON.parse(output.slice(start));
}

function firebaseCli(args) {
  return execFileSync("firebase", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function androidApiKey() {
  const apps = parseFirebaseJson(firebaseCli(["apps:list", "--project", projectId, "--json"])).result ?? [];
  const androidApp = apps.find((app) => app.platform === "ANDROID" && app.state === "ACTIVE");
  if (!androidApp?.appId) throw new Error(`No active Android Firebase app found for ${projectId}.`);
  const config = parseFirebaseJson(firebaseCli([
    "apps:sdkconfig",
    "ANDROID",
    androidApp.appId,
    "--project",
    projectId,
    "--json",
  ])).result;
  const key = JSON.parse(config.fileContents).client?.[0]?.api_key?.[0]?.current_key;
  if (!key) throw new Error("Android Firebase app config did not include an API key.");
  return key;
}

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
  const user = await authRest("accounts:signUp", apiKey, { email, password, returnSecureToken: true });
  const uid = user.localId;
  created.authUserIds.push(uid);
  created.userDocIds.push(uid);
  await admin.auth().updateUser(uid, { displayName: `Codex ${label}`, emailVerified: true });
  await admin.auth().setCustomUserClaims(uid, { roleKeys });
  const signedIn = await authRest("accounts:signInWithPassword", apiKey, { email, password, returnSecureToken: true });
  return { uid, idToken: signedIn.idToken };
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
  if (!response.ok || body.error) throw new Error(`${name} failed: ${JSON.stringify(body.error ?? body)}`);
  return body.result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedClub() {
  const clubId = `${runId}-club`;
  created.clubIds.push(clubId);
  await admin.firestore().collection("clubs").doc(clubId).set({
    name: "Codex Smoke Club",
    status: "active",
    sport: "Football",
    city: "Bruxelles",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  return clubId;
}

async function verifyMembershipRequest(parent, clubId) {
  const result = await callFunction("requestClubMembership", parent.idToken, { clubId });
  assert(result.clubId === clubId, "requestClubMembership returned the wrong club.");
  assert(result.status === "requested", "requestClubMembership did not create a requested membership.");
  assert(result.reused === false, "requestClubMembership unexpectedly reused an existing membership.");
  created.membershipIds.push(result.membershipId);

  const reused = await callFunction("requestClubMembership", parent.idToken, { clubId });
  assert(reused.membershipId === result.membershipId, "Repeated membership request returned a different id.");
  assert(reused.reused === true, "Repeated membership request did not report reuse.");
  return result.membershipId;
}

async function verifySupportReport(parent, adminUser) {
  const result = await callFunction("createReport", parent.idToken, {
    subjectType: "other",
    reason: "Smoke support",
    description: `Disposable support report ${runId}`,
    emergency: false,
  });
  created.reportIds.push(result.reportId);
  assert(result.status === "open", "createReport did not return an open report.");

  const review = await callFunction("reviewReport", adminUser.idToken, {
    reportId: result.reportId,
    status: "closed",
    note: `Reviewed by ${runId}`,
  });
  assert(review.status === "closed", "reviewReport did not close the report.");

  const report = await admin.firestore().collection("reports").doc(result.reportId).get();
  assert(report.data()?.status === "closed", "Closed report was not persisted.");
  return result.reportId;
}

async function cleanup() {
  const db = admin.firestore();
  await Promise.all([
    ...created.reportIds.map((id) => db.collection("reports").doc(id).delete().catch(() => undefined)),
    ...created.membershipIds.map((id) => db.collection("memberships").doc(id).delete().catch(() => undefined)),
    ...created.clubIds.map((id) => db.collection("clubs").doc(id).delete().catch(() => undefined)),
    ...created.userDocIds.map((id) => db.collection("users").doc(id).delete().catch(() => undefined)),
  ]);
  if (created.authUserIds.length) await admin.auth().deleteUsers(created.authUserIds).catch(() => undefined);
}

async function main() {
  admin.initializeApp({ projectId });
  const apiKey = androidApiKey();
  const [parent, adminUser] = await Promise.all([
    createSession("parent", ["parent"], apiKey),
    createSession("admin", ["admin"], apiKey),
  ]);
  await Promise.all([
    callFunction("initializeUserProfile", parent.idToken, { displayName: "Codex Parent" }),
    callFunction("initializeUserProfile", adminUser.idToken, { displayName: "Codex Admin" }),
  ]);

  const clubId = await seedClub();
  const membershipId = await verifyMembershipRequest(parent, clubId);
  const reportId = await verifySupportReport(parent, adminUser);

  console.log(JSON.stringify({
    ok: true,
    projectId,
    runId,
    verified: {
      authProfiles: 2,
      requestedMembership: membershipId,
      reviewedReport: reportId,
    },
  }, null, 2));
}

try {
  await main();
} finally {
  await cleanup();
  await Promise.all(admin.apps.filter(Boolean).map((app) => app.delete()));
}
