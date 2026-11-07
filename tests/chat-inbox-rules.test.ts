import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-chat-inbox-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
afterAll(async () => { await env.clearFirestore(); await env.cleanup(); });

describe("private conversation index rules", () => {
  it("allows only the owner to read or query an entry and no client to modify it", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("chatInboxes/private-entry").set({
        userId: "parent", sourceType: "booking", sourceId: "booking-1", unreadCount: 75,
        lastMessageAt: new Date(), lastMessageBody: "Private conversation",
      });
    });
    const parent = env.authenticatedContext("parent").firestore();
    const outsider = env.authenticatedContext("outsider").firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    await assertSucceeds(parent.doc("chatInboxes/private-entry").get());
    const query = await assertSucceeds(parent.collection("chatInboxes").where("userId", "==", "parent")
      .orderBy("lastMessageAt", "desc").limit(21).get());
    expect(query.size).toBe(1);
    await assertFails(outsider.doc("chatInboxes/private-entry").get());
    await assertFails(anonymous.doc("chatInboxes/private-entry").get());
    await assertFails(outsider.collection("chatInboxes").where("userId", "==", "parent").get());
    expect((await assertSucceeds(outsider.collection("chatInboxes").where("userId", "==", "outsider").get())).empty).toBe(true);
    await assertFails(parent.doc("chatInboxes/forged-entry").set({ userId: "parent", unreadCount: 0 }));
    await assertFails(parent.doc("chatInboxes/private-entry").update({ unreadCount: 0 }));
    await assertFails(parent.doc("chatInboxes/private-entry").update({ lastMessageBody: "Forged preview" }));
    await assertFails(parent.doc("chatInboxes/private-entry").delete());
  });
});
