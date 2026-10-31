import { readFileSync } from "node:fs";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, describe, it } from "vitest";

let environment: RulesTestEnvironment;
const privateCollections = ["childAccountLinks", "childAccountApprovalOwners", "childAccountApprovalRequests",
  "childAccountInvitations", "childAccountInvitationOwners", "childAccountInvitationAccounts"];
beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: "sports-green-moove-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/child-account').set({ roles: { child: true }, childInvitationHash: 'a'.repeat(64) });
    for (const name of privateCollections)
      await context.firestore().doc(`${name}/child-account`).set({ accountUserId: "child-account", childId: "child-profile" });
  });
});
afterAll(async () => { await environment.clearFirestore(); await environment.cleanup(); });

describe("server-owned child account links", () => {
  it('keeps the invited profile fingerprint immutable even for direct administrators', async () => {
    for (const role of ['child', 'parent', 'clubManager', 'admin']) {
      const db = environment.authenticatedContext('child-account', { roleKeys: [role] }).firestore();
      await assertFails(db.doc('users/child-account').update({ childInvitationHash: 'b'.repeat(64) }));
      const fresh = environment.authenticatedContext('new-account', { roleKeys: [role] }).firestore();
      await assertFails(fresh.doc('users/new-account').set({ childInvitationHash: 'b'.repeat(64) }));
    }
  });
  for (const role of [null, "child", "parent", "clubManager", "admin"]) {
    it(`denies direct read, query, create, update and delete for ${role ?? "anonymous"}`, async () => {
      const context = role ? environment.authenticatedContext("child-account", { roleKeys: [role], roles: { [role]: true } }) :
        environment.unauthenticatedContext();
      for (const name of privateCollections) {
        const collection = context.firestore().collection(name), existing = collection.doc("child-account");
        await assertFails(existing.get()); await assertFails(collection.get());
        await assertFails(collection.doc("another-account").set({ childId: "child-profile" }));
        await assertFails(existing.update({ status: "verified" })); await assertFails(existing.delete());
      }
    });
  }
});
