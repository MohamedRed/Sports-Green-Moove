import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-notification-read-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("notifications/private-notice").set({ userId: "parent", read: false, title: "Synthetic QA" });
  });
});
afterAll(async () => { await env.clearFirestore(); await env.cleanup(); });

describe("notification privacy and server-owned acknowledgement", () => {
  it("allows only the addressed account to read and query its notices", async () => {
    const parent = env.authenticatedContext("parent").firestore();
    await assertSucceeds(parent.doc("notifications/private-notice").get());
    expect((await assertSucceeds(parent.collection("notifications").where("userId", "==", "parent").get())).size).toBe(1);
    await assertFails(env.authenticatedContext("other").firestore().doc("notifications/private-notice").get());
    await assertFails(env.unauthenticatedContext().firestore().doc("notifications/private-notice").get());
    await assertFails(parent.collection("notifications").get());
  });
  it("rejects direct owner writes, reverse reads, forged dates, deletion and creation", async () => {
    const owner = env.authenticatedContext("parent").firestore();
    for (const patch of [{ read: true }, { read: false }, { readAt: new Date() }, { userId: "other" }, { title: "Forged" }]) {
      await assertFails(owner.doc("notifications/private-notice").update(patch));
    }
    await assertFails(owner.doc("notifications/private-notice").delete());
    await assertFails(owner.doc("notifications/forged").set({ userId: "parent", read: true }));
  });
});
