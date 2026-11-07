import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
const trip = {
  driverUserId: "driver", title: "Team training", status: "published", seatsTotal: 4, seatsAvailable: 2,
  priceCents: 250, origin: { lat: 50.71, lng: 4.61 }, destination: { lat: 50.85, lng: 4.35 },
  departureAt: "2026-10-18T10:00:00Z", arrivalBy: "2026-10-18T11:00:00Z",
  clubId: "club", teamId: "team", category: "U8", sport: "Football", clubName: "Club QA", teamName: "U8 QA",
  pickupRadiusM: 1500, baggage: "medium", returnTrip: false, supportsVehicleTracking: true,
  supportsChildTracking: true, co2SavedKgEstimate: 7.4, distanceKm: 12, regionGeohash: "u151",
  blockedUserIds: [], passengerInitials: ["QA"], updatedAt: "2026-10-16T10:00:00Z",
};
const mutations = [
  { priceCents: 9000 }, { origin: { lat: 0, lng: 0 } }, { destination: { lat: 0, lng: 0 } },
  { departureAt: "2099-01-01T10:00:00Z" }, { arrivalBy: "2099-01-01T11:00:00Z" },
  { clubId: "other-club" }, { teamId: "other-team" }, { category: "U16" }, { sport: "Tennis" },
  { clubName: "Forged club" }, { teamName: "Forged team" }, { pickupRadiusM: 10000 },
  { baggage: "large" }, { returnTrip: true }, { supportsVehicleTracking: false }, { supportsChildTracking: false },
  { co2SavedKgEstimate: 500 }, { distanceKm: 0 }, { regionGeohash: "elsewhere" },
  { blockedUserIds: ["parent"] }, { passengerInitials: ["FORGED"] }, { updatedAt: "2000-01-01T00:00:00Z" },
  { pendingTripChanges: { approvedByParent: true } },
];
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-trip-details-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("trips/booked-trip").set(trip);
    await context.firestore().doc("bookings/paid-booking").set({ tripId: "booked-trip", driverUserId: "driver",
      parentUserId: "parent", status: "approved", paymentStatus: "paid", seats: 2 });
  });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
const driver = () => env.authenticatedContext("driver", { roleKeys: ["driver"] }).firestore();

describe("server-owned trip details", () => {
  it.each(mutations)("denies a direct driver operational mutation: %j", async (fields) => {
    await assertFails(driver().doc("trips/booked-trip").update(fields));
    expect((await driver().doc("trips/booked-trip").get()).data()).toEqual(trip);
  });

  it.each(["priceCents", "origin", "departureAt", "supportsChildTracking"])("denies removing %s in a replacement document", async (field) => {
    const replacement = Object.fromEntries(Object.entries(trip).filter(([key]) => key !== field));
    await assertFails(driver().doc("trips/booked-trip").set(replacement));
    expect((await driver().doc("trips/booked-trip").get()).data()).toEqual(trip);
  });

  it("rejects a title bundled with an operational change atomically", async () => {
    await assertFails(driver().doc("trips/booked-trip").update({ title: "Must not change", priceCents: 9000 }));
    expect((await driver().doc("trips/booked-trip").get()).data()).toEqual(trip);
  });

  it("preserves the owner's existing cosmetic title edit and booking state", async () => {
    await assertSucceeds(driver().doc("trips/booked-trip").update({ title: "Updated training title" }));
    expect((await driver().doc("trips/booked-trip").get()).data()).toEqual({ ...trip, title: "Updated training title" });
    const saved = (await driver().doc("bookings/paid-booking").get()).data();
    expect(saved).toMatchObject({ status: "approved", paymentStatus: "paid", seats: 2 });
  });

  it.each([null, "parent", "outsider"])("does not grant cosmetic edit authority to %s", async (uid) => {
    const db = uid ? env.authenticatedContext(uid, { roleKeys: ["parent"] }).firestore() : env.unauthenticatedContext().firestore();
    await assertFails(db.doc("trips/booked-trip").update({ title: "Hijacked title" }));
  });

  it("preserves explicit administrator policy", async () => {
    const admin = env.authenticatedContext("admin", { roleKeys: ["admin"] }).firestore();
    await assertSucceeds(admin.doc("trips/booked-trip").update({ priceCents: 300 }));
    expect((await admin.doc("trips/booked-trip").get()).data()?.priceCents).toBe(300);
  });
});
