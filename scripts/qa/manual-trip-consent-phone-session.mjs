import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {tripConsentPhonePhases, verifyTripConsentPhoneState} from './trip-consent-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(!existsSync(output));
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const {auth, db, call, denied, signIn} = await import('./local-flow-client.mjs');
const {getDatabase} = await import('firebase-admin/database');
const {deleteApp} = await import('firebase-admin/app');
const {withLocalAdminCleanup} = await import('./local-admin-lifecycle.mjs');
const {snapshotSessionRestorationRecords} = await import('./session-restoration-records.mjs');
const {seedTripChangeUi} = await import('./local-trip-change-ui.mjs');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let fixture, baseline, completed = false, failure, adminClientClosed = false, firestoreClientTerminated = false;
const save = (file, value) => writeFileSync(resolve(output, file), JSON.stringify(value, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
try {
  await withLocalAdminCleanup(async () => {
    const seeded = await seedTripChangeUi();
    const actors = {driver: await signIn(session.driver), parent: await signIn(session.parent),
      second: await signIn(seeded.secondParent.email), outsider: await signIn(session.outsider)};
    for (const actor of [actors.driver, actors.parent, actors.second]) await call('initializeUserProfile', actor);
    fixture = {...seeded, driverUid: actors.driver.uid, parentUids: [actors.parent.uid, actors.second.uid]};
    const snapshot = async () => snapshotSessionRestorationRecords(db, auth, getDatabase());
    baseline = await snapshot(); save('baseline.json', {projectId: session.projectId, runId: session.runId, fixture, baseline});
    console.log('Three booked trips and two parent accounts prepared. Original price: 2.50 EUR; proposed price: 4.00 EUR. No payment or map call.');
    console.log('Only the phone may propose, decide or withdraw. Observer order: ' + tripConsentPhonePhases.join(', ') + ', finish.');
    console.log('Second synthetic parent: ' + seeded.secondParent.email);
    for await (const line of input) {
      const phase = line.trim(); if (phase === 'stop') break;
      if (phase === 'finish') {assert.equal(checkpoints.length, tripConsentPhonePhases.length); completed = true; break;}
      assert.equal(phase, tripConsentPhonePhases[checkpoints.length]);
      const beforeReads = await snapshot();
      for (const row of beforeReads.documents.tripChanges ?? []) if (Object.values(fixture.fixtures).some(f => f.tripId === row.data.tripId)) {
        for (const [index, actor] of [actors.parent, actors.second].entries()) {
          const view = await call('getTripChangeReview', actor, {tripId: row.data.tripId, proposalId: row.id});
          assert.equal(view.applied, false); assert.equal(view.proposalRequestId, null); assert.equal(view.withdrawalRequestId, null);
          const own = Object.values(fixture.fixtures).find(f => f.tripId === row.data.tripId);
          assert.deepEqual(view.bookingIds, [own.bookingIds[index]]);
          assert(!Object.hasOwn(view, 'parentUserIds') && !Object.hasOwn(view, 'decisions'));
        }
        await denied('getTripChangeReview', actors.outsider, {tripId: row.data.tripId, proposalId: row.id}, 'PERMISSION_DENIED');
      }
      const state = await snapshot(); assert.deepEqual(state, beforeReads, 'Observer reads cannot change the trial');
      const result = verifyTripConsentPhoneState(phase, fixture, state, baseline);
      save(phase + '.json', {projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), state, result});
      checkpoints.push(result); console.log('Independent consent checkpoint passed: ' + phase);
    }
  }, {firestore: {terminate: async () => {await db.terminate(); firestoreClientTerminated = true;}},
    closeApp: async app => {await deleteApp(app); adminClientClosed = true;}});
} catch (error) {failure = error;}
finally {input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); delete process.env.SGM_QA_PASSWORD;}
const sources = ['manual-trip-consent-phone-session.mjs', 'trip-consent-phone-checkpoints.mjs', 'local-trip-change-ui.mjs', 'session-restoration-records.mjs'];
save('session-results.json', {scope: 'independent-trip-consent-record-checkpoints-not-phone-ui-proof', projectId: session.projectId,
  runId: session.runId, testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, fixture,
  protectedRecordCount: baseline ? Object.values(baseline.documents).reduce((n, rows) => n + rows.length, 0) : 0,
  adminClientClosed, firestoreClientTerminated, phoneUiProven: false, wholeProcessRestartProven: false,
  productionWrites: false, routeProviderRequests: 0, applicationExercised: false, realPaymentExercised: false,
  sourceFiles: Object.fromEntries(sources.map(file => ['scripts/qa/' + file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, file))).digest('hex')]))});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Observer closed. Independently dispose of its phone, private helper and owned backend.');
