import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { firestore } from "../lib/firebase.js";
import { ImpactAccumulator, RewardAccumulator } from "../domain/ledgerSummaries.js";

async function readLedger<T>(uid: string, collection: "co2Ledger" | "rewardLedger",
  create: () => { add(id: string, data: Record<string, unknown>): void; result(): T }): Promise<T> {
  return firestore.runTransaction(async transaction => {
    const accumulator = create();
    const query = firestore.collection(collection).where("userId", "==", uid).orderBy(FieldPath.documentId()).limit(200);
    let cursor: QueryDocumentSnapshot | undefined;
    // Every page shares one read-only snapshot; a page boundary must never become a total boundary.
    for (;;) {
      const page = await transaction.get(cursor ? query.startAfter(cursor) : query);
      try { for (const row of page.docs) accumulator.add(row.id, row.data()); }
      catch (error) {
        if (!(error instanceof RangeError)) throw error;
        throw new HttpsError("failed-precondition", "The ledger requires review before displaying a total.");
      }
      if (page.size < 200) break;
      cursor = page.docs.at(-1);
    }
    try { return accumulator.result(); }
    catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new HttpsError("failed-precondition", "The ledger requires review before displaying a total.");
    }
  }, { readOnly: true });
}
export const readImpactSummary = (uid: string) => readLedger(uid, "co2Ledger", () => new ImpactAccumulator(uid));
export const readRewardSummary = (uid: string) => readLedger(uid, "rewardLedger", () => new RewardAccumulator(uid));
