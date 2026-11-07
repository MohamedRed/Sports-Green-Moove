import assert from 'node:assert/strict';
import { renameSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { deleteApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { withLocalAdminCleanup } from '../../scripts/qa/local-admin-lifecycle.mjs';

const [mode, output] = process.argv.slice(2);
assert(['before', 'after', 'task-error'].includes(mode)); assert(isAbsolute(output ?? ''));
const { db } = await import('../../scripts/qa/local-flow-client.mjs');
const expected = new Error('Expected isolated task failure'); let readsCompleted = false, taskErrorPreserved = false;
let firestoreTerminationAcknowledged = false, appDeletionAcknowledged = false;
const task = async () => {
  await db.collection('users').limit(1).get();
  await getDatabase().ref('liveTrips').get();
  readsCompleted = true;
  if (mode === 'task-error') throw expected;
};
if (mode === 'before') await task();
else {
  try { await withLocalAdminCleanup(task, {
    firestore: { terminate: async () => { await db.terminate(); firestoreTerminationAcknowledged = true; } },
    closeApp: async app => { await deleteApp(app); appDeletionAcknowledged = true; },
  }); }
  catch (error) { assert.equal(mode, 'task-error'); assert.equal(error, expected); taskErrorPreserved = true; }
}
if (mode !== 'before') {
  assert.equal(firestoreTerminationAcknowledged, true); assert.equal(appDeletionAcknowledged, true);
  assert.equal(getApps().length, 0);
}
const report = { projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, mode, processId: process.pid,
  scope: 'real-local-admin-client-lifecycle-not-device-proof', readsCompleted,
  registeredAppCount: getApps().length, firestoreTerminationAcknowledged, appDeletionAcknowledged, taskErrorPreserved,
  productionWrites: false, forcedExitUsed: false };
writeFileSync(output + '.pending', JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
renameSync(output + '.pending', output);
if (mode === 'task-error') process.exitCode = 7;
