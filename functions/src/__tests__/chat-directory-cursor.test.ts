import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { directoryCursor, parseDirectoryCursor } from "../lib/chatDirectoryCursor.js";

describe("conversation directory page cursors", () => {
  it("preserves an immutable timestamp and document tie-breaker", () => {
    const at = new Timestamp(1234, 5678);
    const encoded = directoryCursor("inbox", "parent", at, "entry-1");
    const [decoded, id] = parseDirectoryCursor(encoded, "inbox", "parent");
    expect(decoded.isEqual(at)).toBe(true);
    expect(id).toBe("entry-1");
  });
  it("refuses another user's cursor or a cursor for another list", () => {
    const cursor = directoryCursor("inbox", "parent", Timestamp.now(), "entry");
    expect(() => parseDirectoryCursor(cursor, "inbox", "outsider")).toThrow(/another user/);
    expect(() => parseDirectoryCursor(cursor, "bookings", "parent")).toThrow(/different list/);
  });
  it("rejects malformed payloads, unsupported versions, unsafe paths and dates", () => {
    const encode = (change: Record<string, unknown>) => Buffer.from(JSON.stringify({ version: 1,
      kind: "inbox", userId: "p", seconds: 1, nanos: 0, id: "entry", ...change })).toString("base64url");
    for (const value of ["", "!not-base64", "a".repeat(2049), encode({ version: 2 }), encode({ id: "a/b" }),
      encode({ seconds: 253402300800 }), encode({ nanos: 1000000000 }), encode({ seconds: 1.5 })]) {
      expect(() => parseDirectoryCursor(value, "inbox", "p")).toThrow(/Invalid/);
    }
  });
});
