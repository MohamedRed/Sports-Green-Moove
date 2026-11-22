import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { bookingRequestSchema, bookingRequestDocumentId, bookingRequestFingerprint, requireReceiptOwner } from "../domain/bookingRequestIdentity.js";

const input = { tripId: "trip", childId: "child", seats: 2, requesterUserId: "parent", clientRequestId: randomUUID(),
  expectedBookingIntent: { terms: { departureAt: "2027-01-10T10:00:00.000Z", arrivalBy: null,
    origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 }, priceCents: 250 },
  context: { driverUserId: "driver", seatsTotal: 4 } } };
describe("booking operation identity", () => {
  it("requires a valid request identity and explicit account", () => {
    for (const data of [{ ...input, clientRequestId: undefined }, { ...input, clientRequestId: "invalid" },
      { ...input, requesterUserId: undefined }]) expect(bookingRequestSchema.safeParse(data).success).toBe(false);
  });
  it("normalizes UUID case without changing its owner scope", () => {
    expect(bookingRequestSchema.parse({ ...input, clientRequestId: input.clientRequestId.toUpperCase() }).clientRequestId).toBe(input.clientRequestId);
    expect(bookingRequestDocumentId("parent", input.clientRequestId)).not.toBe(bookingRequestDocumentId("other", input.clientRequestId));
  });
  it("binds seats, child, notes, trip and displayed terms to one request", () => {
    const first = bookingRequestFingerprint(bookingRequestSchema.parse(input));
    for (const patch of [{ seats: 3 }, { childId: "other" }, { note: "different" }, { tripId: "other" },
      { expectedBookingIntent: { ...input.expectedBookingIntent, terms: { ...input.expectedBookingIntent.terms, priceCents: 900 } } }]) {
      expect(bookingRequestFingerprint(bookingRequestSchema.parse({ ...input, ...patch }))).not.toBe(first);
    }
  });
  it("canonicalizes equivalent instants and absent optional context fields", () => {
    expect(bookingRequestFingerprint(bookingRequestSchema.parse({ ...input, expectedBookingIntent: {
      terms: { ...input.expectedBookingIntent.terms, departureAt: "2027-01-10T12:00:00+02:00" },
      context: { ...input.expectedBookingIntent.context, teamId: null },
    } }))).toBe(bookingRequestFingerprint(bookingRequestSchema.parse(input)));
  });
  it("never treats malformed, foreign or incomplete receipts as a new operation", () => {
    for (const value of [{}, { uid: "other", clientRequestId: input.clientRequestId, state: "abandoned" },
      { uid: "parent", clientRequestId: input.clientRequestId, state: "committed" }]) {
      expect(() => requireReceiptOwner(value as never, "parent", input.clientRequestId)).toThrow();
    }
    expect(() => requireReceiptOwner({ uid: "parent", clientRequestId: input.clientRequestId, state: "abandoned" },
      "parent", input.clientRequestId)).not.toThrow();
  });
});
