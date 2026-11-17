import { describe, expect, it } from "vitest";
import { REVIEW_PAGE_SIZE, REVIEW_SCAN_SIZE, selectPendingReviews } from "../domain/pendingReviews.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

const ride = (id: string) => ({ id, data: { status: "completed", driverUserId: "driver", participantUserIds: ["parent", "driver"] } });
const rides = (count: number) => Array.from({ length: count }, (_, i) => ride(String(i).padStart(4, "0")));
const authored = (rows: ReturnType<typeof rides>) => new Set(rows.map(row => `${row.id}_driver_parent`));

describe("pending review pagination", () => {
  it("ends an empty list without inventing a cursor", () => {
    expect(selectPendingReviews([], new Set(), "driver")).toEqual({ items: [], lastScannedId: null, hasMore: false });
  });
  it("finds the previously omitted 31st ride and suppresses all submitted reviews", () => {
    const rows = rides(31), result = selectPendingReviews(rows, authored(rows.slice(0, 30)), "driver");
    expect(result.items.map(item => item.rideSessionId)).toEqual(["0030"]);
    expect(result.hasMore).toBe(false);
  });
  it("stops after the last returned pending review, never after an unreturned review", () => {
    const rows = rides(101), result = selectPendingReviews(rows, new Set(), "parent");
    expect(result.items).toHaveLength(REVIEW_PAGE_SIZE);
    expect(result.lastScannedId).toBe("0019"); expect(result.hasMore).toBe(true);
  });
  it("distinguishes exactly one full page from a list with more rows", () => {
    expect(selectPendingReviews(rides(20), new Set(), "driver").hasMore).toBe(false);
    expect(selectPendingReviews(rides(21), new Set(), "driver").hasMore).toBe(true);
  });
  it("returns a progressing continuation through an entirely rated scan window", () => {
    const rows = rides(101), result = selectPendingReviews(rows, authored(rows), "driver");
    expect(result.items).toEqual([]); expect(result.lastScannedId).toBe("0099"); expect(result.hasMore).toBe(true);
    expect(REVIEW_SCAN_SIZE).toBe(100);
  });
  it("does not call an exactly exhausted rated window an unfinished list", () => {
    const rows = rides(100), result = selectPendingReviews(rows, authored(rows), "driver");
    expect(result.items).toEqual([]); expect(result.lastScannedId).toBe("0099"); expect(result.hasMore).toBe(false);
  });
  it("counts completed rides without an eligible target toward scan progress", () => {
    const rows = rides(101).map(row => ({ ...row, data: { ...row.data, participantUserIds: ["driver"] } }));
    const result = selectPendingReviews(rows, new Set(), "driver");
    expect(result.items).toEqual([]); expect(result.lastScannedId).toBe("0099"); expect(result.hasMore).toBe(true);
  });
  it("never lets another author's rating suppress the caller's request", () => {
    expect(selectPendingReviews([ride("one")], new Set(["one_parent_driver"]), "driver").items).toHaveLength(1);
  });
  it("round trips Unicode and punctuation in document IDs, without local lexical sorting", () => {
    const id = "trajet-é_🚌", scope = "pending-reviews:driver";
    expect(parseMembershipPageCursor(membershipPageCursor(scope, id), scope)).toBe(id);
  });
  it("rejects another account's or another feature's cursor", () => {
    const cursor = membershipPageCursor("pending-reviews:driver", "ride");
    expect(() => parseMembershipPageCursor(cursor, "pending-reviews:parent")).toThrow();
    expect(() => parseMembershipPageCursor(cursor, "team:driver")).toThrow();
  });
});
