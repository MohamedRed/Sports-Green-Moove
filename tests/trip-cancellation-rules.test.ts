import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
const original = { driverUserId: "driver", title: "Training", status: "published", seatsTotal: 4, seatsAvailable: 2 };
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-trip-cancellation-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("trips/trip").set(original);
    await context.firestore().doc("tripCancellations/trip").set({ tripId: "trip", actorUserId: "driver" });
  });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe("server-owned trip cancellation", () => {
  it.each([{ status: "cancelled" }, { cancelledAt: new Date() }, { cancelledByUserId: "driver" },
    { cancelReason: "Forged reason" }, { title: "Atomic forgery", status: "cancelled" }])("denies direct driver cancellation fields %j", async (fields) => {
    const db = env.authenticatedContext("driver", { roleKeys: ["driver"] }).firestore();
    await assertFails(db.doc("trips/trip").update(fields));
    expect((await db.doc("trips/trip").get()).data()).toEqual(original);
  });

  it.each(["driver", "parent", "outsider"])("does not permit %s to read, replace or delete server receipts", async (uid) => {
    const db = env.authenticatedContext(uid, { roleKeys: [uid === "driver" ? "driver" : "parent"] }).firestore();
    await assertFails(db.doc("tripCancellations/trip").get());
    await assertFails(db.doc("tripCancellations/trip").set({ tripId: "trip", actorUserId: uid }));
    await assertFails(db.doc("tripCancellations/trip").delete());
    await assertFails(db.doc("tripCancellations/new-trip").set({ tripId: "new-trip", actorUserId: uid }));
  });

  it("retains the driver's existing title edit", async () => {
    const db = env.authenticatedContext("driver", { roleKeys: ["driver"] }).firestore();
    await assertSucceeds(db.doc("trips/trip").update({ title: "Updated training" }));
  });
});
