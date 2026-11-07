import { readFileSync } from "node:fs";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { beforeAll, beforeEach, afterEach, afterAll, describe, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: "sgm-booking-request-rules-test", firestore: {
  host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
} }); });
beforeEach(async () => { await env.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().doc("bookingRequestReceipts/receipt").set({ uid: "parent", state: "committed", response: { bookingId: "booking" } });
}); });
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
describe.each([null, "parent", "driver", "admin"])("server-only booking request receipt: %s", (uid) => {
  const db = () => uid ? env.authenticatedContext(uid, { roleKeys: [uid] }).firestore() : env.unauthenticatedContext().firestore();
  it("denies direct reads", async () => { await assertFails(db().doc("bookingRequestReceipts/receipt").get()); });
  it("denies directory enumeration", async () => { await assertFails(db().collection("bookingRequestReceipts").get()); });
  it("denies forged receipts and abandonment tombstones", async () => {
    await assertFails(db().doc("bookingRequestReceipts/forged").set({ uid: "parent", state: "abandoned" }));
  });
  it("denies rewriting the acknowledgement", async () => {
    await assertFails(db().doc("bookingRequestReceipts/receipt").update({ "response.bookingId": "other" }));
  });
  it("denies deleting the replay fence", async () => { await assertFails(db().doc("bookingRequestReceipts/receipt").delete()); });
});
