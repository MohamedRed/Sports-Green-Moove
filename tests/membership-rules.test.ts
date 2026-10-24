import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-membership-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => { await context.firestore().doc(path).set(data); });
}
const manager = () => env.authenticatedContext("manager", { roleKeys: ["clubManager"] }).firestore();
const active = { userId: "manager", clubId: "club", role: "clubManager", status: "active" };
describe("club membership boundaries", () => {
  it("does not turn a requested ordinary membership into club-management access", async () => {
    await seed("memberships/manager_club", { ...active, role: "member", status: "requested", active: false });
    await seed("memberships/private-request", { userId: "applicant", clubId: "club", status: "requested" });
    await seed("clubs/club", { name: "Club", memberCount: 3 });
    await assertFails(manager().doc("memberships/private-request").get());
    await assertFails(manager().doc("clubs/club").update({ name: "Hijacked" }));
    await assertFails(manager().doc("memberships/manager_club").update({ role: "clubManager", status: "active", active: true }));
  });
  it("allows scoped active manager reads, but decisions cannot bypass the server audit", async () => {
    await seed("memberships/manager_club", active);
    await seed("memberships/own-request", { userId: "applicant", clubId: "club", status: "requested" });
    await seed("memberships/foreign-request", { userId: "applicant", clubId: "foreign", status: "requested" });
    await assertSucceeds(manager().doc("memberships/own-request").get());
    await assertFails(manager().doc("memberships/foreign-request").get());
    await assertFails(manager().doc("memberships/own-request").update({ status: "active", active: true }));
    await assertFails(manager().doc("memberships/new-request").set({ clubId: "club", userId: "applicant", role: "clubManager", status: "active" }));
    await assertFails(manager().doc("memberships/own-request").delete());
  });
  it("revokes club access when the manager is disabled, even with an unexpired role claim", async () => {
    await seed("memberships/manager_club", { ...active, active: false });
    await seed("memberships/own-request", { userId: "applicant", clubId: "club", status: "requested" });
    await assertFails(manager().doc("memberships/own-request").get());
  });
});
