import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, db, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
import { assertPreparedTripDraft, assertTripDraftRestart } from './trip-draft-restart-evidence.mjs';
import { tripChangeHash } from '../../functions/lib/domain/tripChanges.js';

const save = (directory, name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

async function seed() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const ids = [], bookings = [];
  for (const title of ['Brouillon de trajet', 'Autre trajet sans brouillon']) {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), title, priceCents: 250 }); ids.push(tripId);
    const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
    await call('approveBooking', driver, { bookingId }); bookings.push(bookingId);
  }
  return { tripId: ids[0], otherTripId: ids[1], bookingIds: bookings };
}

async function snapshot(fixture) {
  const trips = [], bookings = [], emptyCollections = {};
  for (const tripId of [fixture.tripId, fixture.otherTripId]) {
    trips.push(await document('trips', tripId));
    for (const collection of ['tripChanges', 'tripChangeQuotes', 'tripChangeBalances', 'rideSessions']) {
      const result = await db.collection(collection).where('tripId', '==', tripId).get();
      assert.equal(result.size, 0, `Unsent private edits must not create ${collection}`);
      emptyCollections[collection] = true;
    }
  }
  for (const id of fixture.bookingIds) bookings.push(await document('bookings', id));
  const notifications = (await db.collection('notifications').get()).docs
    .map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
  return { hashes: { trips: tripChangeHash(trips), bookings: tripChangeHash(bookings), notifications: tripChangeHash(notifications) }, emptyCollections };
}

export async function replayTripDraftRestart({ instrument, collect, adb, serial, directory, runId }) {
  const fixture = await seed(), baseline = await snapshot(fixture);
  const args = ['-e', 'draftRestartTripId', fixture.tripId, '-e', 'draftRestartOtherTripId', fixture.otherTripId];
  instrument(['LocalTripDraftRestartTest#prepareUnfinishedTripDraft'], 1, args);
  const checkpoint = await snapshot(fixture);
  assert.deepEqual(checkpoint, baseline, 'Typing/closing/reopening a private draft must not mutate shared data');
  save(directory, 'trip-draft-restart-checkpoint.json', { projectId: 'demo-sgm-local-qa', runId, ...fixture, baseline, checkpoint });
  stopDisposableAppProcess({ adb, serial, runId, outputDir: directory,
    beforeName: 'local-trip-draft-before.json', validateBefore: assertPreparedTripDraft });
  instrument(['LocalTripDraftRestartTest#recoverUnfinishedTripDraftInNewProcess'], 1, args);
  collect();
  const load = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const before = load('local-trip-draft-before.json'), stopped = load('local-trip-draft-stop.json'), after = load('local-trip-draft-after.json');
  assertTripDraftRestart(before, stopped, after, fixture, runId);
  const persisted = await snapshot(fixture);
  assert.deepEqual(persisted, baseline, 'Restart recovery must not submit changes or mutate trips, bookings or notices');
  const captureFiles = ['local-trip-draft-before.png', 'local-trip-draft-restored.png'];
  for (const name of captureFiles) {
    const image = readFileSync(resolve(directory, name));
    assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-private-trip-draft-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 1, nativeCaseCount: 2, steps: [{ id: 'trip-draft-process-restart-ui', status: 'passed' }],
    ...fixture, native: { before, stopped, after }, baseline, checkpoint, persisted, captureFiles,
    recordsUnchanged: true, automaticProposalCreated: false, unresolvedAddressesRestoredAsConfirmed: false,
    fullAppReplay: false, paymentExercised: false, routeProviderExercised: false,
    limitation: 'Driver raw price and unresolved addresses across a guarded new local app process; second trip stays empty. No physical-device, iOS, cross-device sync, route/application or payment proof.' };
  save(directory, 'trip-draft-restart-ui-stage.json', result);
  return result;
}
