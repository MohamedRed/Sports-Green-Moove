import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auth, call, db, denied, signIn } from './local-flow-client.mjs';
import { fetchLocalQa } from './local-http-request.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), checks = [];
const check = async (id, action) => { await action(); checks.push({ id, status: 'passed' }); };
const sources = ['functions/src/domain/profileCity.ts', 'functions/src/services/profileCity.ts',
  'functions/src/callables/profileCity.ts', 'scripts/qa/profile-city-services-suite.mjs', 'firestore.rules'];
const sourceFiles = Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
await withLocalAdminCleanup(async () => {
  execFileSync(process.execPath, [resolve(root, 'scripts/qa/seed-firebase-emulator.mjs')],
    { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), manager = await signIn('c@example.test');
  const protectedCollections = ['users', 'trips', 'bookings', 'children', 'clubs', 'teams', 'memberships'];
  const snapshot = async () => Object.fromEntries(await Promise.all(protectedCollections.map(async name => [name,
    (await db.collection(name).get()).docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => a.id.localeCompare(b.id))])));
  const protectedBefore = await snapshot();
  const actors = [parent, driver, manager];
  const claimsBefore = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const ref = db.collection('profileCities').doc(parent.uid);
  const input = (revision, city = 'Liège') => ({ city, expectedRevision: revision, requestId: randomUUID() });
  const read = (actor = parent) => call('getProfileCity', actor);
  const save = (data, actor = parent) => call('saveProfileCity', actor, data);
  let first;
  await check('authentication-and-server-selected-ownership', async () => {
    await denied('getProfileCity', null, {}, 'UNAUTHENTICATED');
    await denied('saveProfileCity', null, input(0), 'UNAUTHENTICATED');
    for (const field of ['uid', 'userId', 'roles', 'searchOrigin']) {
      await denied('getProfileCity', driver, { [field]: parent.uid }, 'INVALID_ARGUMENT');
      await denied('saveProfileCity', driver, { ...input(0), [field]: parent.uid }, 'INVALID_ARGUMENT');
    }
    assert.deepEqual(await read(), { userId: parent.uid, city: null, revision: 0 });
  });
  await check('strict-text-revision-and-request-validation', async () => {
    for (const city of ['', ' ', 'a'.repeat(101), 'a\nb', 'a\u202eb', '\tWavre', 'a\u200bb'])
      await denied('saveProfileCity', parent, input(0, city), 'INVALID_ARGUMENT');
    for (const patch of [{ expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER }, { requestId: 'bad' }])
      await denied('saveProfileCity', parent, { ...input(0), ...patch }, 'INVALID_ARGUMENT');
    assert.equal((await ref.get()).exists, false);
  });
  await check('save-read-accent-normalization-and-account-isolation', async () => {
    first = input(0, ' Lie\u0300ge ');
    assert.deepEqual(await save(first), { userId: parent.uid, city: 'Liège', revision: 1 });
    assert.deepEqual(await read(), { userId: parent.uid, city: 'Liège', revision: 1 });
    for (const actor of [driver, manager]) {
      assert.equal((await read(actor)).city, null); await save(input(0, 'Namur'), actor);
    }
    assert.equal((await read()).city, 'Liège');
  });
  await check('lost-response-retry-does-not-write-again', async () => {
    // Discard the first returned receipt; the next identical request must be read-only.
    const before = (await ref.get()).data(); assert.equal((await save(first)).revision, 1);
    assert.deepEqual((await ref.get()).data(), before);
    await denied('saveProfileCity', parent, { ...first, city: 'Wavre' }, 'ALREADY_EXISTS');
  });
  await check('concurrent-edits-have-one-winner', async () => {
    const outcomes = await Promise.allSettled([save(input(1, 'Wavre')), save(input(1, 'Bruxelles'))]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'FAILED_PRECONDITION');
    assert.equal((await read()).revision, 2);
  });
  await check('clear-keeps-revision-and-old-retries-cannot-restore-the-city', async () => {
    const removal = input(2, null); assert.equal((await save(removal)).revision, 3);
    assert.deepEqual(await read(), { userId: parent.uid, city: null, revision: 3 });
    await save(removal); await denied('saveProfileCity', parent, first, 'FAILED_PRECONDITION');
    assert.equal((await read()).city, null); await save(input(3, 'Ottignies-Louvain-la-Neuve'));
  });
  await check('malformed-stored-values-fail-closed', async () => {
    const before = (await ref.get()).data();
    for (const patch of [{ userId: driver.uid }, { revision: 0 }, { city: '' }, { city: ' Wavre ' },
      { lastFingerprint: '0'.repeat(64) }, { unexpected: true }]) {
      await ref.set({ ...before, ...patch });
      await denied('getProfileCity', parent, {}, 'FAILED_PRECONDITION');
      await denied('saveProfileCity', parent, input(4), 'FAILED_PRECONDITION');
    }
    await ref.set(before);
  });
  await check('direct-client-get-list-write-and-delete-are-denied', async () => {
    const host = process.env.FIRESTORE_EMULATOR_HOST; assert(/^127\.0\.0\.1:\d+$/.test(host));
    const base = `http://${host}/v1/projects/demo-sgm-local-qa/databases/(default)/documents/profileCities`;
    const before = (await ref.get()).data();
    for (const actor of [null, parent, driver, manager]) for (const [suffix, method] of [['', 'GET'], [`/${parent.uid}`, 'GET'],
      [`/${parent.uid}`, 'DELETE'], [`/${parent.uid}`, 'PATCH']]) {
      const response = await fetchLocalQa(base + suffix, { method, headers: { 'content-type': 'application/json',
        ...(actor ? { authorization: `Bearer ${actor.token}` } : {}) },
        ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { city: { stringValue: 'forged' } } }) } : {}) });
      assert.equal(response.status, 403); await response.arrayBuffer();
    }
    assert.deepEqual((await ref.get()).data(), before);
  });
  await check('profile-auth-initialization-preserves-the-city', async () => {
    const before = (await ref.get()).data(); await call('initializeUserProfile', parent);
    assert.deepEqual((await ref.get()).data(), before);
    // Initialization updates users.updatedAt legitimately; exclude only that timestamp below.
    for (const doc of protectedBefore.users) delete doc.data.updatedAt;
  });
  await check('no-search-trip-booking-role-claim-or-other-profile-side-effects', async () => {
    const after = await snapshot(); for (const doc of after.users) delete doc.data.updatedAt;
    assert.deepEqual(after, protectedBefore);
    assert.equal((await read(driver)).city, 'Namur'); assert.equal((await read(manager)).city, 'Namur');
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claimsBefore);
  });
}, { firestore: db });
const output = process.env.SGM_LOCAL_FLOW_OUTPUT; assert(output);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'authenticated-isolated-profile-city-services-not-native-ui',
  checks, adminClientClosed: true, firestoreClientTerminated: true, sourceFiles,
  providerRequests: 0, productionWrites: false, nativeUiExecuted: false, physicalDevice: false }, null, 2) + '\n', { flag: 'wx' });
console.log('Ten isolated profile-city service groups passed; clients closed.');
