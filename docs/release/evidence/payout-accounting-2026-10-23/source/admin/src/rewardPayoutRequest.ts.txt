export type RewardPayoutRequest = { userId: string; amountCents: number; sourceId: string };
export type PayoutRequestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function validatePayoutReceipt(request: RewardPayoutRequest, raw: unknown): void {
  const receipt = raw as Record<string, unknown> | null;
  if (!receipt || receipt.amountCents !== request.amountCents || receipt.currency !== "eur" ||
      receipt.ledgerId !== `payout_${request.userId}_${request.sourceId}` ||
      typeof receipt.transferId !== "string" || !receipt.transferId)
    throw new Error("La confirmation du versement doit être vérifiée.");
}

export class RewardPayoutRequestJournal {
  readonly key: string;
  constructor(private readonly storage: PayoutRequestStorage, scope: string, private readonly userId: string) {
    this.key = `sgm:reward-payout:v1:${JSON.stringify([scope, userId])}`;
  }
  read(): RewardPayoutRequest | null {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return null;
    const value = JSON.parse(raw) as RewardPayoutRequest;
    if (!value || value.userId !== this.userId || !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0 ||
        typeof value.sourceId !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(value.sourceId))
      throw new Error("Le versement enregistré doit être vérifié avant de continuer.");
    return value;
  }
  prepare(amountCents: number): RewardPayoutRequest {
    const existing = this.read();
    if (existing) return existing;
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Montant du versement invalide.");
    const request = { userId: this.userId, amountCents, sourceId: crypto.randomUUID() };
    this.storage.setItem(this.key, JSON.stringify(request));
    return request;
  }
  complete(request: RewardPayoutRequest): void {
    const stored = this.read();
    if (!stored || stored.sourceId !== request.sourceId || stored.amountCents !== request.amountCents)
      throw new Error("Le versement enregistré a changé. Vérifiez son état.");
    this.storage.removeItem(this.key);
  }
}
