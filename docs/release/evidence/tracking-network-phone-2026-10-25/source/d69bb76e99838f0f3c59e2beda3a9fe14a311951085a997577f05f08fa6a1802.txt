import assert from 'node:assert/strict';

export async function snapshotSessionRestorationRecords(db, auth, database) {
  const collections = (await db.listCollections()).map(item => item.id).sort();
  const documents = Object.fromEntries(await Promise.all(collections.map(async name => [name,
    (await db.collection(name).orderBy('__name__').get()).docs.map(row => {
      const data = row.data();
      // initializeUserProfile deliberately updates only this timestamp on the selected account.
      if (name === 'users' && row.id === 'sgm-qa-parent') delete data.updatedAt;
      return { id: row.id, data };
    })])));
  const users = await auth.listUsers(1000);
  assert(!users.pageToken, 'The isolated account inventory must fit one page');
  const claims = users.users.map(user => ({ uid: user.uid, claims: structuredClone(user.customClaims ?? {}) })).sort((a, b) => a.uid.localeCompare(b.uid));
  const liveTrips = (await database.ref('liveTrips').get()).val();
  return { documents, claims, liveTrips };
}

export function verifySessionRestorationRecords(before, after) {
  assert.deepEqual(after, before, 'Restoration cannot change flow records, foreign accounts, claims or live trips');
  return { allTopLevelCollectionsUnchangedExceptParentTimestamp: true,
    allUserClaimsUnchanged: true, liveTripsUnchanged: true,
    collections: Object.fromEntries(Object.entries(before.documents).map(([name, rows]) => [name, rows.length])),
    accountCount: before.claims.length };
}
