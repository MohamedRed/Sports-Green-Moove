import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { ImpactAccumulator, RewardAccumulator, ledgerSummaryRequest } from "../domain/ledgerSummaries.js";

const uid = "owner", date = "2026-01-01T00:00:00.000Z";
const reward = { userId: uid, currency: "eur", type: "co2Bonus", amountCents: 100, createdAt: date };
const impact = { userId: uid, co2SavedKg: 1.25, distanceMeters: 1_000, createdAt: date };
describe("complete bounded ledger summaries", () => {
  it("returns genuine empty totals and rejects client-selected ownership", () => {
    expect(new ImpactAccumulator(uid).result()).toEqual({ userId: uid, totalCo2Kg: 0, sharedDistanceKm: 0, rideCount: 0, months: [] });
    expect(new RewardAccumulator(uid).result()).toEqual({ userId: uid, balanceCents: 0, entries: [] });
    expect(ledgerSummaryRequest.parse({})).toEqual({});
    for (const input of [{userId: uid}, {limit: 100}, {cursor: "x"}, {roles: ["admin"]}])
      expect(ledgerSummaryRequest.safeParse(input).success).toBe(false);
  });
  it("counts all 1,001 entries while bounding only the returned history", () => {
    const a = new ImpactAccumulator(uid), b = new RewardAccumulator(uid);
    for (let i = 0; i < 1_001; i++) { a.add(`${i}`, impact); b.add(`${i}`, reward); }
    expect(a.result()).toMatchObject({totalCo2Kg: 1_251.25, sharedDistanceKm: 1_001, rideCount: 1_001});
    expect(b.result().balanceCents).toBe(100_100); expect(b.result().entries).toHaveLength(8);
  });
  it("includes late debits and refunds rather than presenting the first page as a balance", () => {
    const b = new RewardAccumulator(uid);
    for (let i = 0; i < 255; i++) b.add(`${i}`, reward);
    b.add("payout", {...reward, amountCents: -50_000, type: "payout"});
    b.add("refund", {...reward, amountCents: 2_500, type: "refund"});
    expect(b.result().balanceCents).toBe(-22_000);
  });
  it("sorts mixed timestamp encodings by time and document identity, not Firestore type order", () => {
    const b = new RewardAccumulator(uid);
    b.add("old", {...reward, createdAt: Timestamp.fromDate(new Date(date))});
    for (const id of ["z", "a"]) b.add(id, {...reward, createdAt: "2026-02-01T00:00:00Z"});
    expect(b.result().entries.map(row => row.id)).toEqual(["a", "z", "old"]);
  });
  it("keeps the six latest occupied Belgian months, regardless of traversal order", () => {
    const a = new ImpactAccumulator(uid);
    for (const month of [8, 1, 7, 2, 6, 3, 5, 4]) a.add(`${month}`, {...impact, createdAt: `2026-${String(month).padStart(2, "0")}-01T00:00:00Z`});
    a.add("brussels-boundary", {...impact, createdAt: "2026-08-31T22:30:00Z"});
    expect(a.result().months.map(row => row.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(a.result().rideCount).toBe(9);
  });
  it("sums meters before converting to whole kilometers", () => {
    const a = new ImpactAccumulator(uid);
    a.add("a", {...impact, distanceMeters: 600}); a.add("b", {...impact, distanceMeters: 600});
    expect(a.result().sharedDistanceKm).toBe(1);
  });
  for (const patch of [{amountCents: 0.5}, {amountCents: "100"}, {amountCents: NaN}, {currency: "usd"},
    {userId: "foreign"}, {type: "unknown"}, {createdAt: null}, {createdAt: "2026-02-31T00:00:00Z"}])
    it(`rejects a malformed reward rather than inventing zero: ${JSON.stringify(patch)}`, () => {
      expect(() => new RewardAccumulator(uid).add("bad", {...reward, ...patch})).toThrow(RangeError);
    });
  for (const patch of [{distanceMeters: undefined}, {distanceMeters: 1.5}, {co2SavedKg: Infinity}, {co2SavedKg: -1}, {userId: "foreign"}])
    it(`rejects incomplete impact: ${JSON.stringify(patch)}`, () => {
      expect(() => new ImpactAccumulator(uid).add("bad", {...impact, ...patch})).toThrow(RangeError);
    });
  it("rejects native integer overflow instead of truncating or wrapping a balance", () => {
    const b = new RewardAccumulator(uid); b.add("a", {...reward, amountCents: 2_147_483_647});
    b.add("b", reward); expect(() => b.result()).toThrow(RangeError);
  });
});
