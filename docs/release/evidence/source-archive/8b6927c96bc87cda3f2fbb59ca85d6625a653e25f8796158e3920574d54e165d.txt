import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

export const ledgerSummaryRequest = z.object({}).strict();
const rewardTypes = z.enum(["ridePayment", "driverEarning", "co2Bonus", "referralBonus", "manualAdjustment", "payout", "refund"]);
const int32Max = 2_147_483_647;
type Row = Record<string, unknown>;
type Reward = { id: string; type: string; amountCents: number; createdAtMillis: number };

function invalid(): never { throw new RangeError("Ledger summary requires valid complete accounting records."); }
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) invalid();
  return value;
}
function kilograms(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) invalid();
  return value;
}
function owner(row: Row, uid: string) { if (row.userId !== uid) invalid(); }
function epoch(value: unknown): number {
  if (value instanceof Timestamp) return Math.floor(value.toMillis());
  if (typeof value !== "string" || !z.iso.datetime({ offset: true }).safeParse(value).success) invalid();
  const millis = Date.parse(value);
  if (!Number.isSafeInteger(millis)) invalid();
  return millis;
}
const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit" });
function monthKey(millis: number) {
  const parts = monthFormatter.formatToParts(millis);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}
function nativeInteger(value: bigint) {
  if (value < -2_147_483_648n || value > BigInt(int32Max)) invalid();
  return Number(value);
}

export class ImpactAccumulator {
  private totalCo2Kg = 0;
  private distanceMeters = 0n;
  private rideCount = 0;
  private months = new Map<string, number>();
  constructor(private readonly uid: string) {}
  add(_id: string, row: Row) {
    owner(row, this.uid);
    const co2 = kilograms(row.co2SavedKg), month = monthKey(epoch(row.createdAt));
    this.distanceMeters += BigInt(integer(row.distanceMeters));
    this.totalCo2Kg = kilograms(this.totalCo2Kg + co2);
    this.rideCount = nativeInteger(BigInt(this.rideCount) + 1n);
    this.months.set(month, kilograms((this.months.get(month) ?? 0) + co2));
    if (this.months.size > 6) this.months.delete([...this.months.keys()].sort()[0]);
  }
  result() {
    return { userId: this.uid, totalCo2Kg: this.totalCo2Kg,
      sharedDistanceKm: nativeInteger(this.distanceMeters / 1_000n), rideCount: this.rideCount,
      months: [...this.months].sort(([a], [b]) => a.localeCompare(b)).map(([month, co2SavedKg]) => ({ month, co2SavedKg })) };
  }
}

export class RewardAccumulator {
  private balance = 0n;
  private entries: Reward[] = [];
  constructor(private readonly uid: string) {}
  add(id: string, row: Row) {
    owner(row, this.uid);
    if (row.currency !== "eur" || !rewardTypes.safeParse(row.type).success) invalid();
    const amountCents = integer(row.amountCents, Number.MIN_SAFE_INTEGER);
    this.balance += BigInt(amountCents);
    const entry = { id, type: row.type as string, amountCents: nativeInteger(BigInt(amountCents)), createdAtMillis: epoch(row.createdAt) };
    this.entries.push(entry);
    this.entries.sort((a, b) => b.createdAtMillis - a.createdAtMillis || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.entries = this.entries.slice(0, 8);
  }
  result() { return { userId: this.uid, balanceCents: nativeInteger(this.balance), entries: this.entries }; }
}
