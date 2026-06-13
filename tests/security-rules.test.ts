import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const PROJECT_ID = "sports-green-moove-rules-test";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: readFileSync("database.rules.json", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearDatabase();
  await testEnv.clearStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seedFirestore(path: string, data: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(path).set(data);
  });
}

async function seedDatabase(path: string, data: unknown): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.database().ref(path).set(data);
  });
}

const BASE_ROLES = {
  admin: false,
  child: false,
  clubManager: false,
  driver: false,
  parent: false,
};

function authed(uid: string, roles: Record<string, boolean> = {}) {
  const claims = { ...BASE_ROLES, ...roles };
  const roleKeys = Object.entries(claims)
    .filter(([, isEnabled]) => isEnabled)
    .map(([role]) => role);
  return testEnv.authenticatedContext(uid, { roleKeys, roles: claims });
}

describe("Firestore rules", () => {
  it("keeps user role and verification fields admin-owned", async () => {
    await seedFirestore("users/alice", {
      displayName: "Alice",
      roles: { parent: true },
      verified: false,
    });
    await seedFirestore("users/bob", { displayName: "Bob" });

    const alice = authed("alice", { parent: true });
    const admin = authed("admin", { admin: true });

    await assertSucceeds(alice.firestore().doc("users/alice").get());
    await assertFails(alice.firestore().doc("users/bob").get());
    await assertFails(alice.firestore().doc("users/alice").update({ roles: { admin: true } }));
    await assertSucceeds(admin.firestore().doc("users/alice").update({ roles: { driver: true } }));
  });

  it("lets only existing guardians update child profiles", async () => {
    await seedFirestore("children/child-1", {
      name: "Leo",
      guardianUserIds: ["guardian"],
    });

    const guardian = authed("guardian", { parent: true });
    const intruder = authed("intruder", { parent: true });

    await assertSucceeds(guardian.firestore().doc("children/child-1").get());
    await assertSucceeds(guardian.firestore().collection("children").where("guardianUserIds", "array-contains", "guardian").get());
    await assertFails(intruder.firestore().doc("children/child-1").get());
    await assertSucceeds(guardian.firestore().doc("children/child-1").update({ name: "Leo B." }));
    await assertFails(guardian.firestore().doc("children/child-1").update({ guardianUserIds: ["guardian", "intruder"] }));
    await assertFails(intruder.firestore().doc("children/child-1").update({ guardianUserIds: ["intruder"] }));
  });

  it("keeps trips controlled by admins and protects driver-owned fields", async () => {
    await seedFirestore("trips/trip-1", {
      title: "U8 Nationaux",
      driverUserId: "driver-1",
      driverVerified: true,
      driverRating: 4.8,
      status: "published",
    });

    const driver = authed("driver-1", { driver: true });
    const otherDriver = authed("driver-2", { driver: true });
    const admin = authed("admin", { admin: true });

    await assertFails(driver.firestore().doc("trips/trip-new").set({ driverUserId: "driver-1", status: "published" }));
    await assertSucceeds(admin.firestore().doc("trips/trip-admin").set({ driverUserId: "driver-1", status: "published" }));
    await assertSucceeds(driver.firestore().doc("trips/trip-1").update({ title: "U8 Nationaux updated" }));
    await assertFails(driver.firestore().doc("trips/trip-1").update({ driverUserId: "driver-2" }));
    await assertFails(otherDriver.firestore().doc("trips/trip-1").update({ title: "Hijacked" }));
  });

  it("limits ride session reads to admins, drivers, and participants", async () => {
    await seedFirestore("rideSessions/ride-1", {
      driverUserId: "driver-1",
      participantUserIds: ["parent-1"],
      childUserIds: ["child-1"],
      status: "active",
    });

    await assertSucceeds(authed("driver-1", { driver: true }).firestore().doc("rideSessions/ride-1").get());
    await assertSucceeds(authed("parent-1", { parent: true }).firestore().doc("rideSessions/ride-1").get());
    await assertSucceeds(authed("child-1", { child: true }).firestore().doc("rideSessions/ride-1").get());
    await assertSucceeds(authed("admin", { admin: true }).firestore().doc("rideSessions/ride-1").get());
    await assertFails(authed("parent-2", { parent: true }).firestore().doc("rideSessions/ride-1").get());
  });

  it("requires messages to be written through Cloud Functions", async () => {
    const sender = authed("parent-1", { parent: true });
    const stranger = authed("stranger", { parent: true });

    await assertFails(sender.firestore().doc("messages/message-1").set({
      senderUserId: "parent-1",
      participantUserIds: ["parent-1", "driver-1"],
      body: "Bonjour",
    }));
    await assertFails(stranger.firestore().doc("messages/message-2").set({
      senderUserId: "stranger",
      participantUserIds: ["parent-1", "driver-1"],
      body: "No access",
    }));
  });

  it("requires ratings and reports to be written through Cloud Functions", async () => {
    const parent = authed("parent-1", { parent: true });
    const admin = authed("admin", { admin: true });

    await assertFails(parent.firestore().doc("ratings/rating-1").set({
      rideSessionId: "ride-1",
      authorUserId: "parent-1",
      ratedUserId: "driver-1",
      score: 5,
    }));
    await assertFails(parent.firestore().doc("reports/report-1").set({
      reporterUserId: "parent-1",
      subjectType: "rideSession",
      reason: "Safety",
      description: "Support review requested.",
    }));
    await seedFirestore("reports/report-2", {
      reporterUserId: "parent-1",
      subjectType: "rideSession",
      reason: "Safety",
      description: "Support review requested.",
      status: "open",
    });
    await assertSucceeds(admin.firestore().doc("reports/report-2").get());
    await assertFails(admin.firestore().doc("reports/report-2").update({
      status: "closed",
      reviewNote: "Handled through console.",
    }));
  });
});

describe("Realtime Database rules", () => {
  it("limits live trip reads to admins, drivers, and participants", async () => {
    await seedDatabase("liveTrips/ride-1", {
      meta: {
        driverUserId: "driver-1",
        participantUserIds: {
          "parent-1": true,
        },
        childUserIds: {
          "child-1": true,
        },
        status: "active",
      },
      vehicle: {
        userId: "driver-1",
        lat: 50.715,
        lng: 4.612,
      },
    });

    const driverDb = authed("driver-1", { driver: true }).database();
    const parentDb = authed("parent-1", { parent: true }).database();
    const childDb = authed("child-1", { child: true }).database();
    const adminDb = authed("admin", { admin: true }).database();
    const strangerDb = authed("stranger", { parent: true }).database();

    await assertSucceeds(driverDb.ref("liveTrips/ride-1/vehicle").get());
    await assertSucceeds(parentDb.ref("liveTrips/ride-1/vehicle").get());
    await assertSucceeds(childDb.ref("liveTrips/ride-1/vehicle").get());
    await assertSucceeds(adminDb.ref("liveTrips/ride-1/vehicle").get());
    await assertFails(strangerDb.ref("liveTrips/ride-1/vehicle").get());
    await assertFails(driverDb.ref("liveTrips/ride-1/vehicle").set({ userId: "driver-1", lat: 50.7, lng: 4.6 }));
  });

  it("allows users to write only their own presence", async () => {
    const aliceDb = authed("alice").database();

    await assertSucceeds(aliceDb.ref("presence/alice").set({ state: "online" }));
    await assertFails(aliceDb.ref("presence/bob").set({ state: "online" }));
  });
});

describe("Storage rules", () => {
  it("limits avatar writes to the owner", async () => {
    const aliceStorage = authed("alice").storage();

    await assertSucceeds(aliceStorage.ref("avatars/alice/avatar.txt").putString("avatar", "raw"));
    await assertFails(aliceStorage.ref("avatars/bob/avatar.txt").putString("avatar", "raw"));
  });

  it("limits club assets to club managers and admins", async () => {
    await assertFails(authed("parent", { parent: true }).storage().ref("clubs/club-1/logo.txt").putString("logo", "raw"));
    await assertSucceeds(
      authed("manager", { clubManager: true }).storage().ref("clubs/club-1/logo.txt").putString("logo", "raw"),
    );
  });

  it("keeps report attachments under the reporter namespace", async () => {
    const reporterStorage = authed("reporter", { parent: true }).storage();

    await assertSucceeds(reporterStorage.ref("reports/reporter/report-1/note.txt").putString("report", "raw"));
    await assertFails(reporterStorage.ref("reports/report-1/note.txt").putString("legacy", "raw"));
    await assertFails(reporterStorage.ref("reports/other/report-1/note.txt").putString("cross", "raw"));
  });
});
