import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { bookingPhonePhases, verifyBookingPhoneCheckpoint } from './manual-booking-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
assert(process.stdin.isTTY, 'Actual phone observations require an interactive controller');
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, document, signIn, tripInput, viewedBooking } = await import('./local-flow-client.mjs');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure, protectedRecordCount = 0;
try {
  const actors = {parent: await signIn(session.parent), driver: await signIn(session.driver), outsider: await signIn(session.outsider)};
  for (const actor of [actors.parent, actors.driver]) await call('initializeUserProfile', actor);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const claims = await Promise.all(Object.values(actors).map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const fixture = {parentUid: actors.parent.uid, driverUid: actors.driver.uid, bookings: []};
  for (const title of ['Accord deux places QA', 'Refus deux places QA']) {
    const {tripId} = await call('createTrip', actors.driver, {...tripInput(), title});
    const {bookingId} = await call('requestBooking', actors.parent,
      await viewedBooking(actors.parent, {tripId, childId: 'sgm-qa-child-lina', seats: 2}));
    fixture.bookings.push({tripId, bookingId, title});
  }
  console.log('Isolated pending requests ready. Observe each phone stage, then enter: ' + bookingPhonePhases.join(', ') + '.');
  console.log('This controller never approves, declines, cancels or marks notices read. Finish with finish or stop.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, bookingPhonePhases.length); completed = true; break; }
    assert.equal(phase, bookingPhonePhases[checkpoints.length]);
    const bookings = [], trips = [], notices = [], inboxes = {};
    for (const item of fixture.bookings) {
      bookings.push({id: item.bookingId, ...await document('bookings', item.bookingId)});
      trips.push({id: item.tripId, ...await document('trips', item.tripId)});
      for (const row of (await db.collection('notifications').where('sourceId', '==', item.bookingId).get()).docs)
        notices.push({id: row.id, ...row.data()});
    }
    for (const [name, actor] of Object.entries(actors)) inboxes[name] = (await call('getInbox', actor)).inbox.notifications
      .filter(note => notices.some(row => row.id === note.id)).map(note => note.id);
    const pendingRequestIds = (await call('listDriverBookingRequests', actors.driver)).bookings.map(row => row.bookingId);
    const state = {bookings, trips, notices, inboxes, pendingRequestIds};
    const result = verifyBookingPhoneCheckpoint(phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if ([`users/${actors.parent.uid}`, `users/${actors.driver.uid}`].includes(path)) {
        const {updatedAt: before, ...oldFields} = original, {updatedAt: after, ...newFields} = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all(Object.values(actors).map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, state, result, protectedRecordCount, originalClaimsUnchanged: true}, null, 2) + '\n',
    {mode: 0o600, flag: 'wx'});
    checkpoints.push(result); console.log('Independent booking checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-booking-phone-session.mjs', 'scripts/qa/manual-booking-phone-checkpoints.mjs',
  'functions/src/callables/bookings.ts', 'functions/src/callables/reservations.ts', 'functions/src/lib/bookingNotifications.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, protectedRecordCount,
  scope: 'independent-booking-record-checkpoints-not-phone-ui-proof', adminClientClosed: true,
  fixtureEnvironmentDestroyed: false, productionWrites: false, paymentExercised: false, pushDeliveryVerified: false,
  sourceFiles: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')]))},
null, 2) + '\n', {mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Booking controller closed; independently destroy its owned local environment.');
