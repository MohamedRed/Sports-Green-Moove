import { readFileSync } from "node:fs";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const actors = [null, "parent", "driver", "admin"];
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-trip-change-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("tripChanges/proposal").set({ tripId: "trip", driverUserId: "driver",
      parentUserIds: ["parent"], status: "pending", decisions: {} });
  });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
const context = (uid: string | null) => uid ? env.authenticatedContext(uid, { roleKeys: [uid] }).firestore() : env.unauthenticatedContext().firestore();
describe("server-owned trip change and parent decisions", () => {
  it.each(actors)("denies direct proposal reads by %s", async (uid) => {
    await assertFails(context(uid).doc("tripChanges/proposal").get());
  });
  it.each(actors)("denies proposal directory queries by %s", async (uid) => {
    await assertFails(context(uid).collection("tripChanges").get());
  });
  it.each(actors)("denies forged proposal creation by %s", async (uid) => {
    await assertFails(context(uid).doc("tripChanges/forged").set({ status: "confirmed", parentUserIds: ["parent"] }));
  });
  it.each(actors)("denies direct acceptance by %s", async (uid) => {
    await assertFails(context(uid).doc("tripChanges/proposal").update({ status: "confirmed", decisions: { parent: { decision: "accept" } } }));
  });
  it.each(actors)("denies deleting parent decision history by %s", async (uid) => {
    await assertFails(context(uid).doc("tripChanges/proposal").delete());
  });
});
