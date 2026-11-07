import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
const trip = { driverUserId: "driver", title: "Team training", seatsTotal: 4, seatsAvailable: 2, status: "published" };
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-trip-capacity-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => { await context.firestore().doc("trips/held-trip").set(trip); });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
const driver = () => env.authenticatedContext("driver", { roleKeys: ["driver"] }).firestore();

describe("booking-owned trip capacity", () => {
  it.each([
    { seatsAvailable: 4 }, { seatsTotal: 8 }, { seatsAvailable: 8, seatsTotal: 8 },
    { seatsAvailable: -1 }, { seatsTotal: 0 }, { seatsAvailable: "4" },
    { title: "Atomic change must fail", seatsAvailable: 4 },
  ])("denies a direct driver capacity mutation: %j", async (fields) => {
    await assertFails(driver().doc("trips/held-trip").update(fields));
    expect((await driver().doc("trips/held-trip").get()).data()).toEqual(trip);
  });

  it.each(["seatsAvailable", "seatsTotal"])("denies removing %s through a replacement document", async (field) => {
    const replacement = Object.fromEntries(Object.entries(trip).filter(([key]) => key !== field));
    await assertFails(driver().doc("trips/held-trip").set(replacement));
    expect((await driver().doc("trips/held-trip").get()).data()).toEqual(trip);
  });

  it("keeps the working driver title edit without permitting parent or outsider mutations", async () => {
    await assertSucceeds(driver().doc("trips/held-trip").update({ title: "Updated training title" }));
    const saved = (await driver().doc("trips/held-trip").get()).data();
    expect(saved).toEqual({ ...trip, title: "Updated training title" });
    for (const uid of ["parent", "outsider"]) {
      const other = env.authenticatedContext(uid, { roleKeys: ["parent"] }).firestore();
      await assertFails(other.doc("trips/held-trip").update({ title: "Hijacked" }));
      await assertFails(other.doc("trips/held-trip").update({ seatsAvailable: 4 }));
    }
    await assertFails(env.unauthenticatedContext().firestore().doc("trips/held-trip").update({ seatsAvailable: 4 }));
  });
});
