import assert from "node:assert/strict";
import { cleanupLiveSmoke, runWithSmokeCleanup } from "../scripts/lib/live-smoke-cleanup.mjs";

function fixture({ failDelete, failLookup, authFailures = [], failAuth = false } = {}) {
  const calls = [];
  const created = {
    authUserIds: ["smoke-user"], userDocIds: ["smoke-user"], childIds: ["smoke-child"],
    tripIds: ["smoke-trip"], bookingIds: ["smoke-booking"], rideSessionIds: ["smoke-ride"],
    messageIds: ["smoke-message", "smoke-message"], notificationIds: ["smoke-notification"],
    ratingIds: ["smoke-rating"], co2LedgerIds: ["smoke-co2"], rewardLedgerIds: ["smoke-reward"],
  };
  const docs = new Set([
    "rideSessions/smoke-ride", "rideSessions/smoke-ride/auditEvents/pickup",
    "rideSessions/customer-ride", "rideSessions/customer-ride/auditEvents/pickup",
  ]);
  const db = {
    collection(name) {
      return {
        doc(id) {
          return { path: `${name}/${id}`, async delete() {
            const path = `${name}/${id}`;
            calls.push(path);
            if (path === failDelete) throw new Error("secret provider detail");
            docs.delete(path);
          } };
        },
        where(field, operator, uid) {
          assert.equal(name, "notifications");
          assert.equal(field, "userId");
          assert.equal(operator, "==");
          assert.equal(uid, "smoke-user");
          return { async get() {
            calls.push("notifications lookup");
            if (failLookup) throw new Error("secret provider detail");
            return { docs: [{ id: "smoke-notification" }, { id: "smoke-generated" }] };
          } };
        },
      };
    },
    async recursiveDelete(ref) {
      calls.push(`recursive ${ref.path}`);
      if (ref.path === failDelete) throw new Error("secret provider detail");
      for (const path of docs) {
        if (path === ref.path || path.startsWith(`${ref.path}/`)) docs.delete(path);
      }
    },
  };
  const admin = {
    firestore: () => db,
    database: () => ({ ref: (path) => ({ async remove() {
      calls.push(path);
      if (path === failDelete) throw new Error("secret provider detail");
    } }) }),
    auth: () => ({ async deleteUsers(ids) {
      calls.push("auth users");
      assert.deepEqual(ids, ["smoke-user"]);
      if (failAuth) throw new Error("secret provider detail");
      return { failureCount: authFailures.length, errors: authFailures.map((index) => ({ index })) };
    } }),
  };
  return { admin, created, calls, docs };
}

const success = fixture();
await cleanupLiveSmoke(success);
assert.equal(success.docs.has("rideSessions/smoke-ride/auditEvents/pickup"), false);
assert.equal(success.docs.has("rideSessions/smoke-ride"), false);
assert.equal(success.docs.has("rideSessions/customer-ride/auditEvents/pickup"), true);
assert.equal(success.docs.has("rideSessions/customer-ride"), true);
assert.equal(success.calls.filter((path) => path === "messages/smoke-message").length, 1);
assert.ok(success.calls.includes("notifications/smoke-generated"));
assert.equal(success.calls.at(-1), "auth users");

for (const failure of ["trips/smoke-trip", "rideSessions/smoke-ride", "liveTrips/smoke-ride"]) {
  const state = fixture({ failDelete: failure });
  await assert.rejects(() => cleanupLiveSmoke(state), (error) => {
    assert.ok(error.message.includes(failure));
    assert.ok(!error.message.includes("secret provider detail"));
    return true;
  });
  assert.ok(state.calls.includes("users/smoke-user"));
  assert.ok(state.calls.includes("auth users"));
}

const lookup = fixture({ failLookup: true });
await assert.rejects(() => cleanupLiveSmoke(lookup), /notifications lookup for smoke-user/);
assert.ok(lookup.calls.includes("notifications/smoke-notification"));
assert.ok(lookup.calls.includes("auth users"));

await assert.rejects(() => cleanupLiveSmoke(fixture({ authFailures: [0] })), /auth user smoke-user/);
await assert.rejects(() => cleanupLiveSmoke(fixture({ failAuth: true })), /cleanup incomplete: auth users/);

const empty = fixture();
Object.keys(empty.created).forEach((key) => empty.created[key] = []);
await cleanupLiveSmoke(empty);
assert.deepEqual(empty.calls, []);

for (const failingSteps of [[], ["run"], ["cleanup"], ["dispose"], ["run", "cleanup", "dispose"]]) {
  const calls = [];
  const step = (name, value) => async () => {
    calls.push(name);
    if (failingSteps.includes(name)) throw new Error(name);
    return value;
  };
  const operation = () => runWithSmokeCleanup({
    run: step("run", { ok: true }), cleanup: step("cleanup"), dispose: step("dispose"),
  });
  if (failingSteps.length) {
    await assert.rejects(operation, (error) => {
      assert.deepEqual(error instanceof AggregateError ? error.errors.map((item) => item.message) : [error.message], failingSteps);
      return true;
    });
  } else {
    assert.deepEqual(await operation(), { ok: true });
  }
  assert.deepEqual(calls, ["run", "cleanup", "dispose"]);
}

console.log("Live smoke cleanup checks passed.");
