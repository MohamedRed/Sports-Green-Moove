import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  trip: {} as Record<string, unknown> | undefined,
  child: {} as Record<string, unknown> | undefined,
  afterPreflight: undefined as (() => void) | undefined,
  retry: undefined as (() => void) | undefined,
  reads: [] as string[], committed: [] as { path: string; data: Record<string, unknown> }[],
  discarded: [] as { path: string; data: Record<string, unknown> }[], attempts: 0,
}));

vi.mock("../lib/firebase.js", () => {
  const snapshot = (path: string) => {
    const value = path.startsWith("trips/") ? state.trip : state.child;
    const copy = value && structuredClone(value);
    return { id: path.split("/")[1], exists: copy !== undefined, data: () => copy };
  };
  const firestore = {
    collection: (name: string) => ({ doc: (id = "new-booking") => ({ path: `${name}/${id}`, id,
      get: async () => {
        const result = snapshot(`${name}/${id}`);
        state.afterPreflight?.();
        return result;
      },
    }) }),
    runTransaction: async (action: (transaction: unknown) => Promise<unknown>) => {
      const attempt = async () => {
        state.attempts++;
        const pending: typeof state.committed = [];
        const result = await action({
          get: async (ref: { path: string }) => { state.reads.push(ref.path); return snapshot(ref.path); },
          create: (ref: { path: string }, data: Record<string, unknown>) => pending.push({ path: ref.path, data }),
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
  data: { tripId: "trip", childId: "child", seats: 2, ...data },
  auth: { uid: "parent", token: { roleKeys: ["parent"] } },
} as Parameters<typeof requestBooking.run>[0]);

beforeEach(() => {
  state.trip = { driverUserId: "driver", status: "published", priceCents: 250,
    departureAt: "2027-01-10T10:00:00.000Z", origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 },
    seatsAvailable: 4, seatsTotal: 4, title: "Initial", clubId: "club", category: "U 7/8" };
  state.child = { displayName: "Initial child", guardianUserIds: ["parent"] };
  state.afterPreflight = undefined; state.retry = undefined; state.reads = [];
  state.committed = []; state.discarded = []; state.attempts = 0;
});

describe("booking transaction consistency", () => {
  it("reads child authority in the same transaction and retains the requested seats and note", async () => {
    await invoke({ note: "Two seats" });
    expect(state.reads).toEqual(["trips/trip", "children/child"]);
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].data).toMatchObject({ seats: 2, note: "Two seats", childLabel: "Initial child", status: "requested" });
  });
  it("preserves the original intent when a simulated SDK retry observes changed price", async () => {
    state.retry = () => { state.trip!.priceCents = 900; };
    await expect(invoke()).rejects.toMatchObject({ code: "aborted" });
    expect(state.attempts).toBe(2); expect(state.discarded).toHaveLength(1); expect(state.committed).toEqual([]);
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
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].data.childLabel).toBe("Updated child");
    expect(state.committed[0].path).toBe(state.discarded[0].path);
  });
  it("returns the current cosmetic title without accepting changed operational terms", async () => {
    state.afterPreflight = () => { state.trip!.title = "Updated title"; };
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
    expect(state.reads).toEqual(["trips/trip"]);
    expect(state.committed[0].data).not.toHaveProperty("childId");
  });
  it("rejects a deleted child without committing a booking", async () => {
    state.afterPreflight = () => { state.child = undefined; };
    await expect(invoke()).rejects.toMatchObject({ code: "permission-denied" });
    expect(state.committed).toEqual([]);
  });
  it("invalid initial terms fail closed before starting the transaction", async () => {
    state.trip!.priceCents = -1;
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.attempts).toBe(0); expect(state.committed).toEqual([]);
  });
  it("allows a separate fresh request after changed terms are reviewed, without saving the stale request", async () => {
    state.afterPreflight = () => { state.trip!.priceCents = 900; state.trip!.appliedChangeId = "b".repeat(64); };
    await expect(invoke()).rejects.toMatchObject({ code: "aborted" });
    expect(state.committed).toEqual([]);
    state.afterPreflight = undefined;
    await invoke();
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].data).toMatchObject({ agreedPriceCents: 900, agreedAmountCents: 1800,
      tripTermsRevision: "b".repeat(64) });
  });
  it("uses current capacity without rejecting an unchanged intent when two seats still fit", async () => {
    state.afterPreflight = () => { state.trip!.seatsAvailable = 3; };
    await invoke();
    expect(state.committed).toHaveLength(1); expect(state.committed[0].data.seats).toBe(2);
  });
});
