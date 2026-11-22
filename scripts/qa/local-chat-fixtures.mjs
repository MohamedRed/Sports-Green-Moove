import { Timestamp } from 'firebase-admin/firestore';
import { auth, db } from './local-flow-client.mjs';

export async function seedLocalChatFixtures(password) {
  await auth.createUser({ uid: 'sgm-qa-outsider', email: 'outsider@example.test', password });
  await auth.setCustomUserClaims('sgm-qa-outsider', { roleKeys: ['parent'] });
  await db.doc('users/sgm-qa-outsider').set({ displayName: 'Visiteur QA', roles: { parent: true } });
  await db.doc('messages/sgm-qa-chat-booking').update({ readByUserIds: ['sgm-qa-driver'] });
  const booking = (await db.doc('bookings/sgm-qa-booking-approved').get()).data();
  await db.doc('bookings/sgm-qa-chat-history').set({ ...booking, status: 'cancelled' });
  const batch = db.batch();
  const createdAt = Timestamp.fromMillis(Date.now() - 86_400_000);
  for (let index = 1; index <= 120; index += 1) {
    const ordinal = String(index).padStart(3, '0');
    batch.set(db.doc(`messages/sgm-qa-history-${ordinal}`), {
      sourceType: 'booking', sourceId: 'sgm-qa-chat-history', senderUserId: 'sgm-qa-driver',
      participantUserIds: ['sgm-qa-parent', 'sgm-qa-driver'], readByUserIds: ['sgm-qa-parent', 'sgm-qa-driver'],
      body: `Historique ${ordinal}`, createdAt,
    });
  }
  await batch.commit();
}
