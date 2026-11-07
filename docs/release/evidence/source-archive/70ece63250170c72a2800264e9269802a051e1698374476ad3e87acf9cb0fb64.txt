import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { tripDraftPhonePhases, verifyTripDraftPhoneCheckpoint } from './trip-draft-phone-checkpoints.mjs';
import { tripSchedulePhoneFixture } from './trip-schedule-phone-fixture.mjs';

const [sessionPath, output, draftKind = 'raw'] = process.argv.slice(2);
assert(['raw', 'schedule'].includes(draftKind) && process.argv.length <= 5);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert.equal(statSync(dirname(sessionPath)).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, db, call, signIn } = await import('./local-flow-client.mjs');
const { getDatabase } = await import('firebase-admin/database');
const { deleteApp } = await import('firebase-admin/app');
const { withLocalAdminCleanup } = await import('./local-admin-lifecycle.mjs');
const { seedPrivateDraftTrips } = await import('./local-trip-draft-restart.mjs');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let fixture, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false;
const save = (file, value) => writeFileSync(resolve(output, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
async function snapshot() {
  const names = (await db.listCollections()).map(row => row.id).sort();
  const documents = Object.fromEntries(await Promise.all(names.map(async name => [name,
    (await db.collection(name).orderBy('__name__').get()).docs.map(row => {
      const data = row.data(); if (name === 'users' && row.id === fixture.driverUid) delete data.updatedAt;
      return { id: row.id, data };
    })])));
  const users = await auth.listUsers(1000); assert(!users.pageToken);
  return JSON.parse(JSON.stringify({ documents, liveData: (await getDatabase().ref('/').get()).val(),
    claims: users.users.map(row => ({ uid: row.uid, claims: row.customClaims ?? {} })).sort((a, b) => a.uid.localeCompare(b.uid)) }));
}
try {
  await withLocalAdminCleanup(async () => {
    const driver = await signIn('d@example.test'); await call('initializeUserProfile', driver);
    const schedule = draftKind === 'schedule' ? tripSchedulePhoneFixture() : null;
    fixture = { ...await seedPrivateDraftTrips(schedule ? { departureAt: schedule.originalDepartureAt } : {}),
      draftKind, ...(schedule ? { schedule } : {}), driverUid: driver.uid, driverEmail: 'd@example.test',
      preparationMethod: 'authenticated-local-service', providerRequests: 0, productionWrites: false };
    const baseline = await snapshot(); verifyTripDraftPhoneCheckpoint('driver-signed-in', baseline, await snapshot(), fixture);
    save('fixture-ready.json', { projectId: session.projectId, runId: session.runId, fixture,
      preparedAt: new Date().toISOString(), scope: 'service-prepared-booked-trips-not-phone-proof' });
    save('baseline.json', baseline);
    console.log('Isolated booked draft trips ready; baseline price is 2.50 EUR. No map or payment request.');
    if (schedule) console.log('Expected schedule UTC: ' + JSON.stringify(schedule));
    console.log('Observer order: ' + tripDraftPhonePhases.join(', ') + ', finish.');
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') { assert.equal(checkpoints.length, tripDraftPhonePhases.length); completed = true; break; }
      assert.equal(phase, tripDraftPhonePhases[checkpoints.length]);
      const state = await snapshot(), result = verifyTripDraftPhoneCheckpoint(phase, baseline, state, fixture);
      save(phase + '.json', { projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), result });
      checkpoints.push(result); console.log('Independent private-draft checkpoint passed: ' + phase);
    }
  }, { firestore: { terminate: async () => { await db.terminate(); firestoreClientTerminated = true; } },
    closeApp: async app => { await deleteApp(app); adminClientClosed = true; } });
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-trip-draft-phone-session.mjs', 'scripts/qa/trip-draft-phone-checkpoints.mjs',
  'scripts/qa/trip-schedule-phone-fixture.mjs', 'scripts/qa/trip-change-schedule-evidence.mjs',
  'scripts/qa/local-trip-draft-restart.mjs', 'scripts/qa/local-trip-input.mjs', 'scripts/qa/start-child-account-phone.mjs'];
save('session-results.json', { projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(),
  scope: 'independent-private-trip-draft-records-not-storage-or-process-proof', completed: completed && !failure,
  fixture, checkpoints, adminClientClosed, firestoreClientTerminated, productionWrites: false, providerRequests: 0,
  physicalUiProvenByThisReport: false, wholeProcessRestartProvenByThisReport: false, draftStorageProvenByThisReport: false,
  proposalCreated: false, realPaymentExercised: false, sourceFiles: Object.fromEntries(paths.map(file => [file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])) });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Private-draft observer closed; independently dispose of phone, connection and local runtime.');
