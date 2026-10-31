import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {trackingPhonePhases, verifyTrackingPhoneCheckpoint} from './tracking-phone-checkpoints.mjs';

const [sessionPath, recordsPath] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(recordsPath ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa');
const read = name => JSON.parse(readFileSync(resolve(recordsPath, name)));
const prior = read('session-results.json'), baseline = read('baseline.json'), signedOut = read('signed-out.json');
assert.equal(prior.runId, session.runId); assert.equal(baseline.runId, session.runId);
assert.equal(signedOut.runId, session.runId);
assert.equal(prior.completed, false);
assert(prior.adminClientClosed && prior.firestoreClientTerminated);
assert.deepEqual(prior.checkpoints.map(point => point.phase), trackingPhonePhases.slice(0, -1));
const output = resolve(recordsPath, 'supplemental-signed-out-stable.json');
assert(!existsSync(output));
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {snapshotSessionRestorationRecords} = await import('./session-restoration-records.mjs');
let result, state, failure, observedForMs, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    // The earlier checkpoint is JSON; compare identical wire representations, including Firestore timestamps.
    const snapshot = async () => JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
    assert.deepEqual(await snapshot(), signedOut.state, 'No record may change before the observation');
    console.log('Read-only sign-out observation started; waiting at least 50 seconds.');
    const started = performance.now();
    await setTimeout(50_000);
    state = await snapshot(); observedForMs = performance.now() - started;
    assert(observedForMs >= 50_000);
    result = verifyTrackingPhoneCheckpoint('signed-out-stable', state, baseline.baseline, prior.fixture, signedOut.state);
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) { failure = error; }
finally { delete process.env.SGM_QA_PASSWORD; }
writeFileSync(output, JSON.stringify({scope: 'supplemental-read-only-sign-out-stability-not-original-run-completion',
  projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), passed: Boolean(result) && !failure,
  observedForMs, state, result, adminClientClosed, firestoreClientTerminated, originalObserverCompleted: false,
  sourceSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  productionWrites: false, realMovementProven: false, childTrackingProven: false, phoneUiProven: false}, null, 2) + '\n',
{mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Supplemental sign-out stability passed; original incomplete report preserved.');
