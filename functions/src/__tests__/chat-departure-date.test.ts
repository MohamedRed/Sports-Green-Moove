import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { chatDepartureDate } from "../domain/chatDepartureDate.js";

describe("conversation trip departure date contract", () => {
  it("uses the actual ISO date written by trip publication", () => {
    expect(chatDepartureDate("2026-10-17T14:30:00.000Z").toISOString()).toBe("2026-10-17T14:30:00.000Z");
    expect(chatDepartureDate("2026-10-17T16:30:00+02:00").toISOString()).toBe("2026-10-17T14:30:00.000Z");
  });
  it("preserves historical timestamp dates without substituting the current time", () => {
    const at = Timestamp.fromDate(new Date("2024-02-29T09:00:00.000Z"));
    expect(chatDepartureDate(at).getTime()).toBe(at.toMillis());
  });
  it("refuses missing, malformed, ambiguous and untyped dates instead of inventing labels", () => {
    for (const value of [undefined, null, "", "tomorrow", "17/10/2026", "2026-10-17", 0, {}, { seconds: 1 }]) {
      expect(() => chatDepartureDate(value)).toThrow(/unavailable/);
    }
  });
});
