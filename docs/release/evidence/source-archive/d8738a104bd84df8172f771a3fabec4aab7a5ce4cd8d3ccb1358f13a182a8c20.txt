import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, statSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {snapshotSessionRestorationRecords, verifySessionRestorationRecords} from './session-restoration-records.mjs';

const directory = '/Users/mrr/.codex/sgm-native-comparison-20261030/search-departure-trial/resumed-20261031';
const path = resolve(directory, 'runtime/session.private.json'); assert.equal(statSync(path).mode & 0o077, 0);
const session = JSON.parse(readFileSync(path)); assert.equal(session.projectId, 'demo-sgm-local-qa');
process.env.SGM_QA_PASSWORD = session.password;
const {auth, db} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const report = JSON.parse(readFileSync(resolve(directory, 'records/results.json')));
assert.equal(report.runId, session.runId); assert.equal(report.completed, false); assert.equal(report.failure, false);
assert.deepEqual(report.checkpoints.map(row => row.phase), ['before']);
let state, isolation, adminClientClosed = false, firestoreClientTerminated = false;
try {
  await withLocalAdminCleanup(async () => {
    const baseline = JSON.parse(readFileSync(resolve(directory, 'records/baseline.json')));
    state = JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords(db, auth, getDatabase())));
    isolation = verifySessionRestorationRecords(baseline, state);
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} finally {delete process.env.SGM_QA_PASSWORD;}
writeFileSync(resolve(directory, 'failure-state.json'), JSON.stringify({scope: 'read-only-state-after-uncompleted-phone-authentication',
  projectId: session.projectId, runId: session.runId, observedAt: new Date().toISOString(), state, isolation,
  completedPhoneFlow: false, calendarReached: false, searchSubmitted: false, realPaymentExercised: false,
  errorCauseEstablished: false, mapRequests: 0, productionWrites: false, adminClientClosed, firestoreClientTerminated,
  sourceFiles: Object.fromEntries(['capture-search-departure-failure.mjs', 'session-restoration-records.mjs'].map(name =>
    ['scripts/qa/' + name, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, name))).digest('hex')]))}, null, 2) + '\n',
{flag: 'wx', mode: 0o600});
console.log('Post-failure records and claims unchanged. No phone date-picker or search acceptance.');
