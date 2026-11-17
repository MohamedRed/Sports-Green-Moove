import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { bookingIntentSnapshot } from "../domain/bookingIntent.js";
import type { Trip } from "../domain/types.js";

const state = vi.hoisted(() => ({
  trip: {} as Record<string, unknown> | undefined,
  child: {} as Record<string, unknown> | undefined,
  beforeTransaction: undefined as (() => void) | undefined,
  rejectNoticeCreate: false,
  retry: undefined as (() => void) | undefined,
  reads: [] as string[], committed: [] as { path: string; data: Record<string, unknown> }[],
  discarded: [] as { path: string; data: Record<string, unknown> }[], attempts: 0,
}));

vi.mock("../lib/firebase.js", () => {
  const snapshot = (path: string) => {
    const value = path.startsWith("trips/") ? state.trip : path.startsWith("children/") ? state.child : undefined;
    const copy = value && structuredClone(value);
    return { id: path.split("/")[1], exists: copy !== undefined, data: () => copy };
  };
  const firestore = {
    collection: (name: string) => ({ doc: (id = "new-booking") => ({ path: `${name}/${id}`, id,
    }) }),
    runTransaction: async (action: (transaction: unknown) => Promise<unknown>) => {
      state.beforeTransaction?.();
      const attempt = async () => {
        state.attempts++;
        const pending: typeof state.committed = [];
        const result = await action({
          get: async (ref: { path: string }) => { state.reads.push(ref.path); return snapshot(ref.path); },
          create: (ref: { path: string }, data: Record<string, unknown>) => {
            if (state.rejectNoticeCreate && ref.path.startsWith("notifications/")) throw new Error("Notice write blocked");
            pending.push({ path: ref.path, data });
          },
        });
        return { result, pending };
      };
      const first = await attempt();
      if (!state.retry) { state.committed.push(...first.pending); return first.result; }
      state.discarded.push(...first.pending);
      state.retry();
      const next = await attempt();
      state.committed.push(...next.pending);
      return next.result;
    },
  };
  return { firestore };
});

import { requestBooking } from "../callables/bookingRequests.js";

const invoke = (data: Record<string, unknown> = {}) => requestBooking.run({
  data: { tripId: "trip", childId: "child", seats: 2,
    clientRequestId: randomUUID(), requesterUserId: "parent",
    expectedBookingIntent: bookingIntentSnapshot(state.trip as Trip), ...data },
  auth: { uid: "parent", token: { roleKeys: ["parent"] } },
} as Parameters<typeof requestBooking.run>[0]);

beforeEach(() => {
  state.trip = { driverUserId: "driver", status: "published", priceCents: 250,
    departureAt: "2027-01-10T10:00:00.000Z", origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 },
    seatsAvailable: 4, seatsTotal: 4, title: "Initial", clubId: "club", category: "U 7/8" };
  state.child = { displayName: "Initial child", guardianUserIds: ["parent"] };
  state.beforeTransaction = undefined; state.retry = undefined; state.reads = [];
  state.rejectNoticeCreate = false;
  state.committed = []; state.discarded = []; state.attempts = 0;
});

describe("booking transaction consistency", () => {
  it("reads child authority in the same transaction and retains the requested seats and note", async () => {
    await invoke({ note: "Two seats" });
    expect(state.reads.filter((path) => !path.startsWith("bookingRequestReceipts/"))).toEqual(["trips/trip", "children/child"]);
    expect(state.reads.filter((path) => path.startsWith("bookingRequestReceipts/"))).toHaveLength(1);
    expect(state.committed).toHaveLength(3);
    expect(state.committed[1].data).toMatchObject({ uid: "parent", state: "committed" });
    expect(state.committed[0].data).toMatchObject({ seats: 2, note: "Two seats", childLabel: "Initial child", status: "requested" });
    expect(state.committed[2]).toMatchObject({ data: { userId: "driver", type: "bookingRequested",
      sourceId: "new-booking", read: false, title: "Nouvelle demande de réservation" } });
    expect(state.committed[2].path).toMatch(/^notifications\/bookingDecision_[a-f0-9]{64}$/);
    expect(state.committed[2].data).not.toHaveProperty("childLabel");
    expect(state.committed[2].data).not.toHaveProperty("note");
  });
  it("preserves the original intent when a simulated SDK retry observes changed price", async () => {
    state.retry = () => { state.trip!.priceCents = 900; };
    await expect(invoke()).rejects.toMatchObject({ code: "aborted" });
    expect(state.attempts).toBe(2); expect(state.discarded).toHaveLength(3); expect(state.committed).toEqual([]);
  });
  it("rechecks guardian authority on every simulated retry", async () => {
    state.retry = () => { state.child!.guardianUserIds = []; };
    await expect(invoke()).rejects.toMatchObject({ code: "permission-denied" });
    expect(state.reads.filter((path) => path === "children/child")).toHaveLength(2);
    expect(state.committed).toEqual([]);
  });
  it("a simulated retry refreshes labels but retains one booking document identity", async () => {
    state.retry = () => { state.child!.displayName = "Updated child"; };
    await invoke();
    expect(state.committed).toHaveLength(3);
    expect(state.committed[0].data.childLabel).toBe("Updated child");
    expect(state.committed[0].path).toBe(state.discarded[0].path);
    expect(state.committed[2].path).toBe(state.discarded[2].path);
  });
  it("returns the current cosmetic title without accepting changed operational terms", async () => {
    state.beforeTransaction = () => { state.trip!.title = "Updated title"; };
    expect((await invoke()).trip.title).toBe("Updated title");
  });
  it("binds a post-change booking amount to the same current applied revision", async () => {
    state.trip!.appliedChangeId = "a".repeat(64);
    await invoke();
    expect(state.committed[0].data).toMatchObject({ agreedPriceCents: 250, agreedAmountCents: 500,
      tripTermsRevision: "a".repeat(64) });
  });
  it("retains the existing adult-booking path without inventing a child", async () => {
    await invoke({ childId: undefined });
    expect(state.reads.filter((path) => !path.startsWith("bookingRequestReceipts/"))).toEqual(["trips/trip"]);
    expect(state.committed[0].data).not.toHaveProperty("childId");
  });
  it("rejects a deleted child without committing a booking", async () => {
    state.beforeTransaction = () => { state.child = undefined; };
    await expect(invoke()).rejects.toMatchObject({ code: "permission-denied" });
    expect(state.committed).toEqual([]);
  });
  it("invalid persisted terms fail closed without writing", async () => {
    state.beforeTransaction = () => { state.trip!.priceCents = -1; };
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.committed).toEqual([]);
  });
  it("allows a separate fresh request after changed terms are reviewed, without saving the stale request", async () => {
    state.beforeTransaction = () => { state.trip!.priceCents = 900; state.trip!.appliedChangeId = "b".repeat(64); };
    await expect(invoke()).rejects.toMatchObject({ code: "aborted" });
    expect(state.committed).toEqual([]);
    state.beforeTransaction = undefined;
    await invoke();
    expect(state.committed).toHaveLength(3);
    expect(state.committed[0].data).toMatchObject({ agreedPriceCents: 900, agreedAmountCents: 1800,
      tripTermsRevision: "b".repeat(64) });
  });
  it("uses current capacity without rejecting an unchanged intent when two seats still fit", async () => {
    state.beforeTransaction = () => { state.trip!.seatsAvailable = 3; };
    await invoke();
    expect(state.committed).toHaveLength(3); expect(state.committed[0].data.seats).toBe(2);
  });
  it("refuses changed details even when they changed before the server call", async () => {
    const displayed = bookingIntentSnapshot(state.trip as Trip);
    state.trip!.priceCents = 900;
    await expect(invoke({ expectedBookingIntent: displayed })).rejects.toMatchObject({ code: "aborted" });
    expect(state.committed).toEqual([]);
  });
  it("does not silently substitute server terms for a missing or malformed displayed snapshot", async () => {
    for (const expectedBookingIntent of [undefined, null, {}, { terms: {}, context: {} }])
      await expect(invoke({ expectedBookingIntent })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(state.attempts).toBe(0); expect(state.committed).toEqual([]);
  });
  it("refuses a trip without an identifiable recipient instead of silently dropping the request notice", async () => {
    for (const driverUserId of [undefined, null, ""]) {
      state.trip!.driverUserId = "driver";
      state.beforeTransaction = () => { state.trip!.driverUserId = driverUserId; };
      await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
      expect(state.committed).toEqual([]);
    }
  });
  it("does not commit a booking or receipt when creating its notice fails", async () => {
    state.rejectNoticeCreate = true;
    await expect(invoke()).rejects.toThrow("Notice write blocked");
    expect(state.committed).toEqual([]);
  });
});
