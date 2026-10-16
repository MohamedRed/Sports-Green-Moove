import { describe, expect, it } from "vitest";
import { tripChangeDecisionSchema, tripChangeHash, tripChangeProposalSchema, tripChangeSourceData,
  tripChangeTermsSchema, tripChangeWithdrawalSchema } from "../domain/tripChanges.js";

const terms = { departureAt: "2026-12-01T10:00:00Z", arrivalBy: "2026-12-01T11:00:00Z",
  origin: { lat: 50.71, lng: 4.61 }, destination: { lat: 50.85, lng: 4.35 }, priceCents: 250 };
const requestId = "11111111-1111-4111-8111-111111111111";
const proposal = { tripId: "trip", requestId, expectedRevision: "a".repeat(64), terms };
describe("trip change revision contract", () => {
  it("accepts complete price, route and schedule terms and explicit missing arrival", () => {
    expect(tripChangeTermsSchema.parse(terms)).toEqual(terms);
    expect(tripChangeTermsSchema.parse({ ...terms, arrivalBy: null }).arrivalBy).toBeNull();
    expect(tripChangeProposalSchema.parse(proposal)).toEqual(proposal);
  });
  it.each([{ priceCents: -1 }, { priceCents: 1.5 }, { priceCents: 100001 },
    { origin: { lat: 91, lng: 0 } }, { destination: { lat: 0, lng: 181 } },
    { departureAt: "tomorrow" }, { arrivalBy: "2026-12-01T09:00:00Z" },
    { departureAt: "2026-12-01" }, { parentUserId: "forged" }, { seatsAvailable: 8 },
  ])("rejects malformed or client-owned extra terms %j", (change) => {
    expect(tripChangeTermsSchema.safeParse({ ...terms, ...change }).success).toBe(false);
  });
  it("requires an explicit full review, request identity and source revision", () => {
    for (const key of ["terms", "requestId", "expectedRevision"]) {
      expect(tripChangeProposalSchema.safeParse(Object.fromEntries(Object.entries(proposal).filter(([name]) => key !== name))).success).toBe(false);
    }
    expect(tripChangeProposalSchema.safeParse({ ...proposal, requestId: "retry" }).success).toBe(false);
    expect(tripChangeProposalSchema.safeParse({ ...proposal, expectedRevision: "old" }).success).toBe(false);
  });
  it("decision authority never comes from client-supplied parent or booking identifiers", () => {
    const decision = { tripId: "trip", proposalId: "b".repeat(64), requestId, proposalRevision: "c".repeat(64), decision: "accept" };
    expect(tripChangeDecisionSchema.parse(decision)).toEqual(decision);
    for (const extra of [{ parentUserId: "other" }, { bookingIds: ["foreign"] }, { applied: true }])
      expect(tripChangeDecisionSchema.safeParse({ ...decision, ...extra }).success).toBe(false);
    expect(tripChangeDecisionSchema.safeParse({ ...decision, decision: "silent" }).success).toBe(false);
    expect(tripChangeDecisionSchema.safeParse({ ...decision, proposalRevision: undefined }).success).toBe(false);
    expect(tripChangeWithdrawalSchema.safeParse({ tripId: "trip", proposalId: "b".repeat(64), requestId }).success).toBe(true);
  });
  it("hashes nested records canonically while preserving array order and exact numeric terms", () => {
    expect(tripChangeHash({ b: { y: 2, x: 1 }, a: 0 })).toBe(tripChangeHash({ a: 0, b: { x: 1, y: 2 } }));
    expect(tripChangeHash(["a", "b"])).not.toBe(tripChangeHash(["b", "a"]));
    expect(tripChangeHash(terms)).not.toBe(tripChangeHash({ ...terms, priceCents: 251 }));
  });
  it("ignores only the proposal marker and its write time, not future operational fields", () => {
    const source = { ...terms, title: "Training", pendingChangeId: "a", updatedAt: 1, futureCondition: "original" };
    expect(tripChangeSourceData(source)).toEqual({ ...terms, title: "Training", futureCondition: "original" });
    expect(tripChangeHash(tripChangeSourceData(source))).toBe(tripChangeHash(tripChangeSourceData({ ...source, pendingChangeId: "b", updatedAt: 2 })));
    expect(tripChangeHash(tripChangeSourceData(source))).not.toBe(tripChangeHash(tripChangeSourceData({ ...source, futureCondition: "new" })));
  });
});
