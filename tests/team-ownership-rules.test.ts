import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;
const original = { clubId: "club-b", name: "Team B", category: "U8", status: "active" };
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "sgm-team-ownership-rules-test", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("teams/team-b").set(original);
    for (const clubId of ["club-a", "club-b"]) {
      await db.doc(`memberships/both_${clubId}`).set({ userId: "both", clubId, role: "clubManager", status: "active", active: true });
    }
    await db.doc("memberships/manager-a_club-a").set({ userId: "manager-a", clubId: "club-a", role: "clubManager", status: "active", active: true });
    await db.doc("memberships/manager-b_club-b").set({ userId: "manager-b", clubId: "club-b", role: "clubManager", status: "active", active: true });
  });
});
afterEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });
const manager = (uid: string) => env.authenticatedContext(uid, { roleKeys: ["clubManager"] }).firestore();
const saved = async () => (await env.unauthenticatedContext().firestore().doc("teams/team-b").get()).data();

describe("team club ownership", () => {
  it.each(["update", "replace", "merge"])("denies a foreign manager takeover through %s and preserves the complete team", async (method) => {
    const ref = manager("manager-a").doc("teams/team-b");
    const changed = { ...original, clubId: "club-a", name: "Taken over" };
    if (method === "update") await assertFails(ref.update(changed));
    else if (method === "merge") await assertFails(ref.set(changed, { merge: true }));
    else await assertFails(ref.set(changed));
    expect(await saved()).toEqual(original);
  });

  it("does not let even a manager of both clubs reassign an existing team", async () => {
    await assertFails(manager("both").doc("teams/team-b").update({ clubId: "club-a" }));
    expect(await saved()).toEqual(original);
  });

  it("keeps creation, editing, replacement and deletion available to the scoped active manager", async () => {
    const db = manager("manager-b");
    await assertSucceeds(db.doc("teams/new-team").set({ ...original, name: "New team" }));
    await assertSucceeds(db.doc("teams/team-b").update({ name: "Updated team", category: "U10" }));
    expect(await saved()).toEqual({ ...original, name: "Updated team", category: "U10" });
    await assertSucceeds(db.doc("teams/team-b").set({ ...original, name: "Replaced team" }));
    await assertSucceeds(db.doc("teams/new-team").delete());
  });

  it("denies foreign edits, foreign creations and foreign deletes without relying on a renamed club", async () => {
    const db = manager("manager-a");
    await assertFails(db.doc("teams/team-b").update({ name: "Foreign edit" }));
    await assertFails(db.doc("teams/team-b").delete());
    await assertFails(db.doc("teams/new-team").set(original));
    expect(await saved()).toEqual(original);
  });

  it.each(["requested", "refused", "inactive", "revoked", "blocked"])("denies a %s manager even with an existing role claim", async (status) => {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("memberships/manager-b_club-b").update({ status });
    });
    const db = manager("manager-b");
    await assertFails(db.doc("teams/team-b").update({ name: "Denied" }));
    await assertFails(db.doc("teams/team-b").delete());
    await assertFails(db.doc("teams/new-team").set(original));
    expect(await saved()).toEqual(original);
  });

  it("denies disabled, forged and ordinary memberships, missing manager claims and signed-out writes", async () => {
    for (const fields of [{ active: false }, { role: "member" }, { userId: "other" }, { clubId: "club-a" }]) {
      await env.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc("memberships/manager-b_club-b").set({ userId: "manager-b", clubId: "club-b", role: "clubManager", status: "active", ...fields });
      });
      await assertFails(manager("manager-b").doc("teams/team-b").update({ name: "Denied" }));
    }
    await assertFails(env.authenticatedContext("manager-a", { roleKeys: ["parent"] }).firestore()
      .doc("teams/new-team").set({ ...original, clubId: "club-a" }));
    await assertFails(env.unauthenticatedContext().firestore().doc("teams/team-b").update({ name: "Denied" }));
    expect(await saved()).toEqual(original);
  });

  it("rejects deleting the club ownership field while preserving public team discovery", async () => {
    const { clubId: _clubId, ...withoutClub } = original;
    await assertFails(manager("manager-b").doc("teams/team-b").set(withoutClub));
    await assertSucceeds(env.unauthenticatedContext().firestore().collection("teams").get());
    expect(await saved()).toEqual(original);
  });

  it("preserves the existing explicit administrator authority", async () => {
    const db = env.authenticatedContext("admin", { roleKeys: ["admin"] }).firestore();
    await assertSucceeds(db.doc("teams/team-b").update({ clubId: "club-a", name: "Administrator move" }));
    expect(await saved()).toEqual({ ...original, clubId: "club-a", name: "Administrator move" });
    await assertSucceeds(db.doc("teams/team-b").delete());
  });
});
