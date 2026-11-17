import { Timestamp } from 'firebase-admin/firestore';
import { auth, db, signIn } from './local-flow-client.mjs';

export async function seedChatDirectoryFixtures() {
  const actors = {};
  for (const [role, roleKeys] of [['parent', ['parent']], ['driver', ['parent', 'driver']], ['outsider', ['parent']]]) {
    const uid = `sgm-qa-directory-${role}`;
    const email = `directory-${role}@example.test`;
    await auth.createUser({ uid, email, password: process.env.SGM_QA_PASSWORD });
    await auth.setCustomUserClaims(uid, { roleKeys });
    await db.doc(`users/${uid}`).set({ displayName: `Directory ${role} QA`, roles: Object.fromEntries(roleKeys.map((key) => [key, true])) });
    actors[role] = await signIn(email);
  }
  const sourceIds = [];
  const createdAt = Timestamp.fromMillis(Date.now() - 86_400_000);
  await db.doc('trips/sgm-qa-directory-trip').set({ title: 'Trajet des conversations QA', driverUserId: actors.driver.uid, departureAt: createdAt });
  const batch = db.batch();
  for (let index = 0; index < 26; index += 1) {
    const id = `sgm-qa-directory-${String(index).padStart(3, '0')}`;
    sourceIds.push(id);
    batch.set(db.doc(`bookings/${id}`), { tripId: 'sgm-qa-directory-trip', parentUserId: actors.parent.uid,
      requesterUserId: actors.parent.uid, driverUserId: actors.driver.uid, status: 'approved', createdAt });
    if (index === 25) continue;
    batch.set(db.doc(`messages/${id}`), { sourceType: 'booking', sourceId: id,
      participantUserIds: [actors.parent.uid, actors.driver.uid], senderUserId: actors.parent.uid,
      readByUserIds: [actors.parent.uid], body: `Ancienne conversation ${index}`, createdAt });
  }
  await batch.commit();
  return { ...actors, sourceIds };
}
