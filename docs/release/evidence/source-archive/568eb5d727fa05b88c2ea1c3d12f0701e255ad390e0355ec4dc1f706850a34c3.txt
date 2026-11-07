import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';

export async function seedLedgerHistory(db, uid, foreignUid) {
  assert.equal(db.projectId, 'demo-sgm-local-qa');
  assert.match(uid, /^sgm-qa-/); assert.match(foreignUid, /^sgm-qa-/); assert.notEqual(uid, foreignUid);
  for (const collection of ['rewardLedger', 'co2Ledger']) {
    const batch = db.batch();
    for (let index = 1; index <= 257; index++) {
      const id = `ledger-${String(index).padStart(3, '0')}`;
      const date = new Date(Date.UTC(2026, index % 7, 1, 0, index));
      const createdAt = index % 2 ? Timestamp.fromDate(date) : date.toISOString();
      const row = collection === 'rewardLedger' ? { userId: uid, currency: 'eur', sourceId: id,
        amountCents: index === 256 ? -50_000 : index === 257 ? 2_500 : 100,
        type: index === 256 ? 'payout' : index === 257 ? 'refund' : 'driverEarning', createdAt } :
        { userId: uid, type: 'rideCompletion', sourceId: id, distanceMeters: 1_000, co2SavedKg: 1.25, createdAt };
      batch.create(db.collection(collection).doc(id), row);
    }
    batch.create(db.collection(collection).doc('foreign'), collection === 'rewardLedger' ?
      { userId: foreignUid, currency: 'eur', sourceId: 'foreign', amountCents: 999_999, type: 'co2Bonus', createdAt: Timestamp.now() } :
      { userId: foreignUid, type: 'rideCompletion', sourceId: 'foreign', distanceMeters: 999_999, co2SavedKg: 999, createdAt: Timestamp.now() });
    await batch.commit();
  }
}
