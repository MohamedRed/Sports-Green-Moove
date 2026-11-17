import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID, createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {deleteApp} from 'firebase-admin/app';
import {auth, call, db, denied, signIn} from './local-flow-client.mjs';
import {fetchLocalQa} from './local-http-request.mjs';
import {withLocalAdminCleanup} from './local-admin-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), observations = [], checks = [];
const ruleHash = createHash('sha256').update(readFileSync(resolve(root, 'firestore.rules'))).digest('hex');
const baseline = process.env.SGM_CHAT_SOURCE_BASELINE === 'true';
if (baseline) assert.equal(ruleHash, 'cc4829a2f1474ef4b52c4cfb98c14bd50128c7b1f882dd4623e104aeb8240240', 'Baseline requires the frozen original rules');
let failure, adminClientClosed = false, firestoreClientTerminated = false, protectedRecordCount = 0;
const check = async (id, action) => {
  try {await action(); checks.push({id, status: 'passed'});}
  catch (error) {checks.push({id, status: 'failed', code: error.code ?? error.name}); throw error;}
  finally {console.log(`${id}: ${checks.at(-1).status}`);}
};
const host = process.env.FIRESTORE_EMULATOR_HOST; assert(/^127\.0\.0\.1:\d+$/.test(host));
const base = `http://${host}/v1/projects/demo-sgm-local-qa/databases/(default)/documents`;
const headers = actor => ({'content-type': 'application/json', ...(actor ? {authorization: `Bearer ${actor.token}`} : {})});
const read = async (actor, messageId) => {
  const response = await fetchLocalQa(`${base}/messages/${messageId}`, {headers: headers(actor)});
  await response.arrayBuffer(); return response.status;
};
const query = async (actor, source) => {
  const response = await fetchLocalQa(`${base}:runQuery`, {method: 'POST', headers: headers(actor), body: JSON.stringify({
    structuredQuery: {from: [{collectionId: 'messages'}], where: {compositeFilter: {op: 'AND', filters: [
      {fieldFilter: {field: {fieldPath: 'participantUserIds'}, op: 'ARRAY_CONTAINS', value: {stringValue: actor.uid}}},
      ...[['sourceType', source.sourceType], ['sourceId', source.sourceId]].map(([fieldPath, value]) =>
        ({fieldFilter: {field: {fieldPath}, op: 'EQUAL', value: {stringValue: value}}})),
    ]}}, orderBy: [{field: {fieldPath: 'createdAt'}, direction: 'DESCENDING'},
      {field: {fieldPath: '__name__'}, direction: 'DESCENDING'}], limit: 51},
  })});
  const result = await response.json(); return {status: response.status, rows: Array.isArray(result) ? result.filter(row => row.document).length : null};
};
try {
  await withLocalAdminCleanup(async () => {
    execFileSync(process.execPath, [resolve(root, 'scripts/qa/seed-firebase-emulator.mjs')],
      {env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000});
    const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
    const accounts = [];
    for (const [key, role] of [['next', 'parent'], ['child', 'child'], ['outsider', 'parent']]) {
      const uid = `sgm-qa-chat-source-${key}`, email = `${key}-chat-source@example.test`;
      await auth.createUser({uid, email, password: process.env.SGM_QA_PASSWORD});
      await auth.setCustomUserClaims(uid, {roleKeys: [role]});
      await db.collection('users').doc(uid).set({displayName: `Compte QA ${key}`});
      accounts.push(await signIn(email));
    }
    const [next, child, outsider] = accounts, protectedRows = new Map();
    for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs)
      protectedRows.set(row.ref.path, row.data());
    const actors = [parent, driver, ...accounts];
    const claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
    const cases = [
      {id: 'booking-parent-precedes-retained-requester', kind: 'booking', old: parent, retained: driver,
        before: {parentUserId: parent.uid, requesterUserId: parent.uid, driverUserId: driver.uid}, patch: {parentUserId: next.uid}},
      {id: 'booking-null-parent-uses-requester', kind: 'booking', old: parent, retained: driver,
        before: {parentUserId: null, requesterUserId: parent.uid, driverUserId: driver.uid}, patch: {requesterUserId: next.uid}},
      {id: 'booking-driver-removal', kind: 'booking', old: driver, retained: parent,
        before: {parentUserId: parent.uid, driverUserId: driver.uid}, patch: {driverUserId: next.uid}},
      {id: 'ride-participant-removal', kind: 'rideSession', old: parent, retained: driver,
        before: {driverUserId: driver.uid, participantUserIds: [parent.uid], childUserIds: []}, patch: {participantUserIds: []}},
      {id: 'ride-child-removal', kind: 'rideSession', old: child, retained: driver,
        before: {driverUserId: driver.uid, participantUserIds: [parent.uid], childUserIds: [child.uid]}, patch: {childUserIds: []}},
      {id: 'ride-driver-removal', kind: 'rideSession', old: driver, retained: parent,
        before: {driverUserId: driver.uid, participantUserIds: [parent.uid], childUserIds: []}, patch: {driverUserId: next.uid}},
      {id: 'deleted-source', kind: 'booking', old: parent, retained: driver, deleted: true,
        before: {parentUserId: parent.uid, driverUserId: driver.uid}},
      {id: 'cancellation-does-not-remove-participants', kind: 'booking', old: parent, retained: driver, allowed: true,
        before: {parentUserId: parent.uid, driverUserId: driver.uid, status: 'approved'}, patch: {status: 'cancelled'}},
    ];
    for (const item of cases) await check(item.id, async () => {
      const source = {sourceType: item.kind, sourceId: 'sgm-qa-chat-source-' + item.id};
      const ref = db.collection(item.kind === 'booking' ? 'bookings' : 'rideSessions').doc(source.sourceId);
      assert(!(await ref.get()).exists); await ref.set(item.before);
      const sourceKey = item.kind === 'booking' ? 'bookingId' : 'rideSessionId';
      const sent = await call('sendChatMessage', item.retained, {[sourceKey]: source.sourceId, body: 'Message QA isolé', clientMessageId: randomUUID()});
      const messageRef = db.collection('messages').doc(sent.messageId), original = (await messageRef.get()).data();
      assert.equal((await call('getChatConversation', item.old, source)).conversation.currentUserId, item.old.uid);
      const initialGet = await read(item.old, sent.messageId), initialQuery = await query(item.old, source);
      observations.push({id: item.id, phase: 'before-source-change', directGet: initialGet, query: initialQuery});
      assert.equal(initialGet, 200); assert.deepEqual(initialQuery, {status: 200, rows: 1});
      assert.equal(await read(outsider, sent.messageId), 403); assert.equal(await read(null, sent.messageId), 403);
      if (item.deleted) await ref.delete(); else await ref.update(item.patch);
      if (item.allowed) await call('getChatConversation', item.old, source);
      else await denied('getChatConversation', item.old, source, item.deleted ? 'NOT_FOUND' : 'PERMISSION_DENIED');
      const direct = await read(item.old, sent.messageId), listing = await query(item.old, source);
      const expected = item.allowed || baseline ? 200 : 403;
      assert.equal(direct, expected); assert.equal(listing.status, expected);
      if (expected === 200) assert.equal(listing.rows, 1);
      assert.equal(await read(item.retained, sent.messageId), item.deleted && !baseline ? 403 : 200);
      assert.equal(await read(next, sent.messageId), 403, 'New source members cannot read history that never addressed them');
      if (!baseline && Object.values(item.patch ?? {}).includes(next.uid)) {
        await call('getChatConversation', next, source);
        assert.deepEqual(await query(next, source), {status: 200, rows: 0}, 'A current participant may open an empty addressed history');
      }
      assert.deepEqual((await messageRef.get()).data(), original, 'Revocation/read checks must not rewrite or delete history');
      observations.push({id: item.id,sourceType: item.kind,apiAfter: item.allowed ? 'allowed' : item.deleted ? 'NOT_FOUND' : 'PERMISSION_DENIED',
        directGetAfter: direct, queryAfter: listing.status, historicalMessagePreserved: true});
    });
    await check('unrelated-records-and-all-account-claims-preserved', async () => {
      for (const [path, value] of protectedRows) assert.deepEqual((await db.doc(path).get()).data(), value, path);
      protectedRecordCount = protectedRows.size;
      assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    });
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
const files = ['scripts/qa/chat-source-access-suite.mjs', 'functions/src/callables/messages.ts', 'functions/src/callables/chatRead.ts',
  'functions/src/lib/chatConversation.ts', 'functions/src/domain/access.ts', 'firestore.rules'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: baseline ? 'original-rules-reproduce-revoked-direct-read-not-accepted' : 'isolated-current-source-chat-rules-not-production-or-native',
  baseline, completed: !failure, checks, observations, protectedRecordCount, adminClientClosed, firestoreClientTerminated,
  providerRequests: 0, productionWrites: false, nativeUiExecuted: false, failureCode: failure ? failure.code ?? failure.name : null,
  sourceFiles: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error('Chat source access check failed; retain the sanitized original result.');
