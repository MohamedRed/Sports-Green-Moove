import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {snapshotSessionRestorationRecords, verifySessionRestorationRecords} from './session-restoration-records.mjs';

const [path, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert(isAbsolute(path ?? '') && isAbsolute(output ?? '') && !existsSync(output) && process.stdin.isTTY);
assert.equal(statSync(path).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
assert.equal(session.parent, 'p@example.test'); assert(typeof session.password === 'string' && session.password.length >= 12);
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, call, signIn} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const phases = ['before', 'home', 'search-light', 'search-dark', 'trips-dark', 'rewards-dark', 'rewards-light', 'signed-out'];
mkdirSync(output, {mode: 0o700});
const save = (file, value) => writeFileSync(resolve(output, file + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure = false, baseline;
let adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    await call('initializeUserProfile', await signIn(session.parent));
    baseline = await snapshotSessionRestorationRecords(db, auth, getDatabase());
    save('baseline', baseline);
    console.log('Visual-only phone observer ready. Commands: ' + phases.join(', ') + ', finish.');
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, phases.length); completed = true; break;}
      assert.equal(phase, phases[checkpoints.length]);
      const state = await snapshotSessionRestorationRecords(db, auth, getDatabase());
      const isolation = verifySessionRestorationRecords(baseline, state);
      const result = {phase, recordedAt: new Date().toISOString(), isolation};
      save(phase, {projectId: session.projectId, runId: session.runId, ...result, state});
      checkpoints.push(result); console.log('Unchanged isolated records: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {
  failure = true; save('failure', {type: error?.name === 'AssertionError' ? 'AssertionError' : 'PreparationOrReadFailure',
    operator: typeof error?.operator === 'string' ? error.operator : null, checkpointsCompleted: checkpoints.length});
} finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;
}
save('results', {scope: 'independent-visual-trial-records-not-phone-ui-or-full-accessibility', projectId: session.projectId,
  runId: session.runId, completed: completed && !failure, failure, checkpoints, observedAt: new Date().toISOString(),
  physicalUiProven: false, providerRequests: 0, productionWrites: false, realPaymentExercised: false,
  adminClientClosed, firestoreClientTerminated,
  sourceFiles: Object.fromEntries(['manual-accent-appearance-phone.mjs', 'session-restoration-records.mjs'].map(file =>
    ['scripts/qa/' + file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, file))).digest('hex')]))});
if (failure) throw new Error('Visual observer failed; retain its original record without accepting the phone trial.');
