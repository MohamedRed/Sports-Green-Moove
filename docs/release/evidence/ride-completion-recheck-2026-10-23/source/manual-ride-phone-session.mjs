import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { ridePhonePhases, verifyRidePhoneCheckpoint } from './manual-ride-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(process.stdin.isTTY);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, signIn, tripInput, viewedBooking } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure, protectedRecordCount = 0, droppedAt;
try {
  const parent = await signIn(session.parent), driver = await signIn(session.driver);
  for (const actor of [parent, driver]) await call('initializeUserProfile', actor);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs)
    baseline.set(row.ref.path, row.data());
  const claims = await Promise.all([parent, driver].map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Fin de trajet QA', priceCents: 0 });
  const { bookingId } = await call('requestBooking', parent,
    await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats: 2 }));
  await call('approveBooking', driver, { bookingId });
  const fixture = { tripId, bookingId, childId: 'sgm-qa-child-lina', parentUid: parent.uid, driverUid: driver.uid };
  writeFileSync(resolve(output, 'fixture.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId, ...fixture,
    scope: 'approved-booking-fixture-not-phone-booking-decision-proof' }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('One free two-seat child booking prepared. Observe phone stages, then enter: ' + ridePhonePhases.join(', '));
  console.log('After preparation this controller only reads; it never starts, picks up, drops off, ends or rates a ride.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, ridePhonePhases.length); completed = true; break; }
    assert.equal(phase, ridePhonePhases[checkpoints.length]);
    if (phase === 'stable') assert(performance.now() - droppedAt >= 1_500, 'Observe the phone again after the age tick');
    const rows = async query => (await query.get()).docs.map(row => ({ id: row.id, ...row.data() }));
    const trip = (await db.doc('trips/' + tripId).get()).data(), booking = (await db.doc('bookings/' + bookingId).get()).data();
    const rides = await rows(db.collection('rideSessions').where('tripId', '==', tripId));
    const rideId = rides[0]?.id;
    const state = { trip: { id: tripId, ...trip }, booking: { id: bookingId, ...booking }, rides,
      audit: rideId ? await rows(db.collection('rideSessions').doc(rideId).collection('auditEvents')) : [],
      ...Object.fromEntries(await Promise.all([['co2', 'co2Ledger'], ['rewards', 'rewardLedger'], ['ratings', 'ratings']]
        .map(async ([key, collection]) => [key, rideId ? await rows(db.collection(collection).where('rideSessionId', '==', rideId)) : []]))) };
    const result = verifyRidePhoneCheckpoint(phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if ([`users/${parent.uid}`, `users/${driver.uid}`].includes(path)) {
        const { updatedAt: before, ...oldFields } = original, { updatedAt: after, ...newFields } = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all([parent, driver].map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, state, result, protectedRecordCount, originalClaimsUnchanged: true }, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); if (phase === 'dropped-off') droppedAt = performance.now();
    console.log('Independent ride checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-ride-phone-session.mjs', 'scripts/qa/manual-ride-phone-checkpoints.mjs',
  'functions/src/callables/rideStart.ts', 'functions/src/callables/ridePassengers.ts', 'functions/src/callables/rides.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveRideActions.kt'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, protectedRecordCount,
  scope: 'independent-ride-record-checkpoints-not-phone-ui-proof', adminClientClosed: true,
  fixtureEnvironmentDestroyed: false, productionWrites: false, paymentExercised: false, physicalTrackingAccepted: false,
  sourceFiles: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) },
null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Ride controller closed; independently destroy its owned local environment.');
