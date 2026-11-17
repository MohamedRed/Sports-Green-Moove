import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { viewedBooking, call, db, signIn, tripInput } from './local-flow-client.mjs';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { indexLocalChatFixtures } from './index-local-chat-fixtures.mjs';

export async function seedChatDirectoryUiFixtures() {
  configureLocalEmulators();
  const departureAt = Timestamp.fromMillis(Date.now() - 2 * 86_400_000);
  const batch = db.batch();
  for (let index = 1; index <= 25; index += 1) {
    const ordinal = String(index).padStart(2, '0');
    const id = `sgm-qa-directory-ui-${ordinal}`;
    batch.set(db.doc(`trips/${id}`), { ...tripInput(), driverUserId: 'sgm-qa-driver', status: 'completed',
      title: `Trajet archivé ${ordinal}`, departureAt, createdAt: departureAt, completedAt: departureAt });
    batch.set(db.doc(`bookings/${id}`), { tripId: id, parentUserId: 'sgm-qa-parent', requesterUserId: 'sgm-qa-parent',
      driverUserId: 'sgm-qa-driver', childLabel: 'Lina QA', status: 'completed', seats: 1, createdAt: departureAt });
    batch.set(db.doc(`messages/${id}`), { sourceType: 'booking', sourceId: id, body: `Ancien rendez-vous ${ordinal}`,
      senderUserId: 'sgm-qa-driver', participantUserIds: ['sgm-qa-parent', 'sgm-qa-driver'],
      readByUserIds: ['sgm-qa-driver'], createdAt: departureAt });
  }
  await batch.commit();
  await indexLocalChatFixtures();
  const driver = await signIn('d@example.test');
  const parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Nouveau trajet de discussion QA' });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  const indexes = await db.collection('chatInboxes').where('userId', '==', parent.uid).get();
  assert.equal(indexes.size, 27, 'Two existing conversations plus 25 archived fixtures');
  const archives = indexes.docs.filter((doc) => doc.get('sourceId').startsWith('sgm-qa-directory-ui-'));
  archives.sort((a, b) => a.id.localeCompare(b.id));
  return { bookingId, tripId, oldestSourceId: archives[0].get('sourceId') };
}
