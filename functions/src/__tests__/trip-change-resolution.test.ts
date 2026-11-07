import { describe, expect, it } from "vitest";
import { tripChangeRequestReferenceSchema } from "../domain/tripChanges.js";

describe("read-only trip proposal resolution input", () => {
  const input = { tripId: "trip", requestId: "11111111-1111-4111-8111-111111111111" };
  it("uses only a trip and stable request identity, never a caller-supplied owner", () => {
    expect(tripChangeRequestReferenceSchema.parse(input)).toEqual(input);
    for (const extra of [{ driverUserId: "other" }, { proposalId: "a".repeat(64) }, { recorded: true }])
      expect(tripChangeRequestReferenceSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("rejects missing, malformed and path-like identities", () => {
    for (const change of [{ tripId: "../foreign" }, { tripId: "" }, { requestId: "retry" }, { requestId: undefined }])
      expect(tripChangeRequestReferenceSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
