import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {auth, db, signIn} from './local-flow-client.mjs';
import {checkMembershipReview} from './local-membership-review.mjs';
import {fetchLocalQa} from './local-http-request.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const checks = [], root = resolve(import.meta.dirname, '../..');
let failure, review, protectedRecordCount = 0, adminClientClosed = false, firestoreClientTerminated = false;
const check = async (id, action) => {
  try {await action(); checks.push({id, status: 'passed'});}
  catch (error) {checks.push({id, status: 'failed', error: error.code ?? error.name}); throw error;}
  finally {console.log(`${id}: ${checks.at(-1).status}`);}
};
try {
  await withLocalAdminCleanup(async () => {
    execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
      {env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000});
    await check('versioned-review-races-approval-rejection-and-authority', async () => {review = await checkMembershipReview();});
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
    const clubId = 'sgm-qa-client-catalog', membershipId = `${parent.uid}_${clubId}`;
    const host = process.env.FIRESTORE_EMULATOR_HOST; assert(/^127\.0\.0\.1:\d+$/.test(host));
    const base = `http://${host}/v1/projects/demo-sgm-local-qa/databases/(default)/documents`;
    const query = async (actor, uid, club) => fetchLocalQa(`${base}:runQuery`, {
      method: 'POST', headers: {'content-type': 'application/json', ...(actor ? {authorization: `Bearer ${actor.token}`} : {})},
      body: JSON.stringify({structuredQuery: {from: [{collectionId: 'memberships'}], limit: 2,
        where: {compositeFilter: {op: 'AND', filters: [['userId', uid], ['clubId', club]].map(([fieldPath, value]) =>
          ({fieldFilter: {field: {fieldPath}, op: 'EQUAL', value: {stringValue: value}}}))}}}}),
    });
    const read = async (actor, suffix, method = 'GET') => fetchLocalQa(base + suffix, {
      method, headers: {'content-type': 'application/json', authorization: `Bearer ${actor.token}`},
    });
    await check('absent-document-is-denied-but-own-empty-query-is-readable', async () => {
      const absent = await read(parent, `/memberships/${membershipId}`); assert.equal(absent.status, 403); await absent.arrayBuffer();
      const response = await query(parent, parent.uid, clubId); assert.equal(response.status, 200);
      assert((await response.json()).every(row => !row.document));
    });
    await db.collection('memberships').doc(membershipId).set({userId: parent.uid, clubId, role: 'member', status: 'requested', active: false});
    const protectedRows = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs)
      protectedRows.set(row.ref.path, row.data());
    const claims = await Promise.all([parent, driver].map(async actor => (await auth.getUser(actor.uid)).customClaims));
    await check('own-query-returns-exact-persisted-pending-record', async () => {
      const response = await query(parent, parent.uid, clubId); assert.equal(response.status, 200);
      const rows = (await response.json()).filter(row => row.document);
      assert.equal(rows.length, 1); assert(rows[0].document.name.endsWith('/memberships/' + membershipId));
      assert.equal(rows[0].document.fields.status.stringValue, 'requested'); assert.equal(rows[0].document.fields.active.booleanValue, false);
    });
    await check('foreign-and-anonymous-queries-stay-denied', async () => {
      for (const actor of [driver, null]) {
        const response = await query(actor, parent.uid, clubId); assert.equal(response.status, 403); await response.arrayBuffer();
      }
    });
    await check('membership-direct-delete-stays-denied', async () => {
      const response = await read(parent, `/memberships/${membershipId}`, 'DELETE'); assert.equal(response.status, 403); await response.arrayBuffer();
    });
    await check('catalog-uses-document-order-with-a-bounded-next-page', async () => {
      const response = await fetchLocalQa(`${base}:runQuery`, {method: 'POST', headers: {'content-type': 'application/json',
        authorization: `Bearer ${parent.token}`}, body: JSON.stringify({structuredQuery: {from: [{collectionId: 'clubs'}],
          orderBy: [{field: {fieldPath: '__name__'}, direction: 'ASCENDING'}], limit: 21}})});
      assert.equal(response.status, 200); const rows = (await response.json()).filter(row => row.document); assert.equal(rows.length, 21);
      const names = rows.map(row => row.document.name); assert.deepEqual(names, [...names].sort());
    });
    await check('reads-and-denied-actions-preserve-all-records-and-claims', async () => {
      let count = 0;
      for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) {
        count++; assert.deepEqual(row.data(), protectedRows.get(row.ref.path), row.ref.path);
      }
      assert.equal(count, protectedRows.size); protectedRecordCount = count;
      assert.deepEqual(await Promise.all([parent, driver].map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
const files = ['scripts/qa/local-membership-client.mjs', 'scripts/qa/local-membership-review.mjs', 'firestore.rules', 'firestore.indexes.json'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'isolated-membership-services-and-client-rules-not-native-ui', completed: !failure,
  checks, review, protectedRecordCount, adminClientClosed, firestoreClientTerminated, productionWrites: false,
  failureCode: failure ? failure.code ?? failure.name : null, providerRequests: 0, phoneUiExecuted: false,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error('Isolated membership check failed; retain the original sanitized result.');
