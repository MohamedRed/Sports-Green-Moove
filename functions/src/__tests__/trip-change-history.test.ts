import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { parseTripHistoryCursor, tripHistoryCursor, tripChangeHistoryInput } from "../domain/tripChangeHistory.js";

describe("trip change history input and pagination scope", () => {
  const at = new Timestamp(1792300000, 123456789), id = "a".repeat(64);
  const cursor = tripHistoryCursor("parent", "trip", at, id);
  it("retains nanosecond ordering and binds pages to both trip and signed-in user", () => {
    expect(parseTripHistoryCursor(cursor, "parent", "trip")).toEqual([at, id]);
    expect(() => parseTripHistoryCursor(cursor, "other", "trip")).toThrow(/another user/);
    expect(() => parseTripHistoryCursor(cursor, "parent", "other")).toThrow(/another trip/);
    expect(tripChangeHistoryInput.parse({ tripId: "trip", cursor })).toEqual({ tripId: "trip", cursor });
  });
  it("does not accept supplied owner, role, parent list or page-size authority", () => {
    for (const extra of [{ userId: "driver" }, { role: "driver" }, { parentUserIds: ["other"] }, { limit: 1000 }])
      expect(tripChangeHistoryInput.safeParse({ tripId: "trip", ...extra }).success).toBe(false);
  });
  it("rejects malformed or differently typed cursors rather than inventing a first page", () => {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
    for (const patch of [{ version: 2 }, { kind: "inbox" }, { tripId: "../trip" }, { id: "bad" },
      { nanos: -1 }, { nanos: 1_000_000_000 }, { seconds: 0.1 }, { userId: "" }, { extra: true }]) {
      const changed = Buffer.from(JSON.stringify({ ...decoded, ...patch })).toString("base64url");
      expect(() => parseTripHistoryCursor(changed, "parent", "trip")).toThrow(/Invalid trip history cursor/);
    }
    for (const value of ["", "%not-base64", "a".repeat(2049), Buffer.from("null").toString("base64url")])
      expect(() => parseTripHistoryCursor(value, "parent", "trip")).toThrow();
  });
});
