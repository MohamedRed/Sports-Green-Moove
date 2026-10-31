import { beforeEach, describe, expect, it } from "vitest";
import { RewardPayoutRequestJournal, validatePayoutReceipt } from "../admin/src/rewardPayoutRequest.js";

let entries: Map<string, string>;
const storage = { getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
const journal = (scope = "isolated:admin", user = "driver") => new RewardPayoutRequestJournal(storage, scope, user);
beforeEach(() => { entries = new Map(); });
describe("management payout request journal", () => {
  it("retains identity and original money across reload and a changed displayed balance", () => {
    const original = journal().prepare(750);
    expect(journal().read()).toEqual(original);
    expect(journal().prepare(1500)).toEqual(original);
  });
  it("creates a new identity only after confirmation clears the matching stored request", () => {
    const store = journal(), original = store.prepare(750);
    store.complete(original);
    expect(store.read()).toBeNull();
    expect(store.prepare(750).sourceId).not.toBe(original.sourceId);
  });
  it("isolates project, administrator and recipient scope", () => {
    journal().prepare(750);
    expect(journal("other:admin").read()).toBeNull();
    expect(journal("isolated:other").read()).toBeNull();
    expect(journal("isolated:admin", "other-driver").read()).toBeNull();
  });
  it.each(["invalid-json", "null", '{"userId":"other"}', '{"userId":"driver","sourceId":"test","amountCents":0}'])(
    "fails closed for corrupt storage %s", (raw) => {
      const store = journal(); entries.set(store.key, raw);
      expect(() => store.prepare(750)).toThrow(); expect(entries.get(store.key)).toBe(raw);
    });
  it("does not silently continue when persistence fails", () => {
    const store = new RewardPayoutRequestJournal({ ...storage, setItem: () => { throw new Error("Synthetic unavailable storage"); } }, "isolated", "driver");
    expect(() => store.prepare(750)).toThrow("Synthetic unavailable storage");
    expect(entries.size).toBe(0);
  });
  it("does not clear a different request", () => {
    const store = journal(), request = store.prepare(750);
    expect(() => store.complete({ ...request, sourceId: "another" })).toThrow();
    expect(store.read()).toEqual(request);
  });
  it("requires a matching financial receipt before accepting confirmation", () => {
    const request = journal().prepare(750);
    const receipt = { amountCents: 750, currency: "eur", ledgerId: `payout_driver_${request.sourceId}`, transferId: "tr_synthetic" };
    expect(() => validatePayoutReceipt(request, receipt)).not.toThrow();
    for (const raw of [null, {}, { ...receipt, amountCents: 751 }, { ...receipt, currency: "usd" },
      { ...receipt, ledgerId: "other" }, { ...receipt, transferId: "" }])
      expect(() => validatePayoutReceipt(request, raw)).toThrow();
  });
});
