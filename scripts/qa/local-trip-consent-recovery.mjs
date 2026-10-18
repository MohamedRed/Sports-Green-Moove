import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, db, denied, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { unchangedTripDetails } from './trip-change-inputs-evidence.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
import { recoveryKinds, assertPreparedRecovery, assertRecoveryRecords, assertRecoveryRestart } from './trip-consent-recovery-evidence.mjs';
import { tripChangeHash } from '../../functions/lib/domain/tripChanges.js';

const secondEmail = 'trip-change-parent-two@example.test';
const save = (directory, name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

async function seed() {
  const driver = await signIn('d@example.test'), parents = [await signIn('p@example.test'), await signIn(secondEmail)];
  const fixtures = {};
  for (const kind of recoveryKinds) {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), title: `Reprise des accords QA ${kind}`, priceCents: 250 });
    const bookingIds = [], bookingsBefore = [];
    for (const parent of parents) {
      const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
      await call('approveBooking', driver, { bookingId });
      bookingIds.push(bookingId); bookingsBefore.push(await document('bookings', bookingId));
    }
    fixtures[kind] = { tripId, bookingIds, bookingsBefore, before: unchangedTripDetails(await document('trips', tripId)),
      driverUid: driver.uid, parentUids: parents.map((parent) => parent.uid) };
  }
  return fixtures;
}

async function snapshot(fixtures) {
  const records = [];
  for (const kind of recoveryKinds) {
    const fixture = fixtures[kind], trip = await document('trips', fixture.tripId), bookings = [];
    for (const id of fixture.bookingIds) bookings.push(await document('bookings', id));
    const changes = await db.collection('tripChanges').where('tripId', '==', fixture.tripId).get();
    assert.equal(changes.size, 1);
    const list = async (collection, field, value) => (await db.collection(collection).where(field, '==', value).get())
      .docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const proposalId = changes.docs[0].id;
    const change = changes.docs[0].data(), notifications = await list('notifications', 'proposalId', proposalId);
    const checked = assertRecoveryRecords({ trip, bookings, proposalId, change, notifications,
      quotes: await list('tripChangeQuotes', 'tripId', fixture.tripId), balances: await list('tripChangeBalances', 'tripId', fixture.tripId) }, fixture, kind);
    records.push({ ...checked, hashes: { trip: tripChangeHash(trip), bookings: tripChangeHash(bookings), proposal: tripChangeHash(change),
      notifications: tripChangeHash([...notifications].sort((a, b) => a.id.localeCompare(b.id))) } });
  }
  return records;
}

export async function replayTripConsentRecovery({ instrument, collect, adb, serial, directory, runId }) {
  const fixtures = await seed();
  const argumentsByKind = recoveryKinds.map((kind) => ({ kind, tripId: fixtures[kind].tripId,
    bookingId: fixtures[kind].bookingIds[0], secondBookingId: fixtures[kind].bookingIds[1],
    expectedTimeLabel: new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', hour: '2-digit',
      minute: '2-digit', hourCycle: 'h23' }).format(new Date(fixtures[kind].before.departureAt)).replace(':', 'h') }));
  const args = ['-e', 'consentRecoveryFixtures', Buffer.from(JSON.stringify(argumentsByKind)).toString('base64url'),
    '-e', 'consentRecoverySecondEmail', secondEmail];
  instrument(['LocalTripConsentRecoveryTest#prepareRecoveryStates'], 1, args);
  const checkpoint = await snapshot(fixtures);
  save(directory, 'trip-consent-recovery-checkpoint.json', { projectId: 'demo-sgm-local-qa', runId, records: checkpoint });
  stopDisposableAppProcess({ adb, serial, runId, outputDir: directory,
    beforeName: 'local-trip-consent-recovery-before.json', validateBefore: assertPreparedRecovery });
  instrument(['LocalTripConsentRecoveryTest#reopenRecoveryStates'], 1, args);
  collect();
  const load = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const before = load('local-trip-consent-recovery-before.json'), after = load('local-trip-consent-recovery-after.json');
  const stopped = load('local-trip-consent-recovery-stop.json');
  assertRecoveryRestart(before, stopped, after, fixtures, runId);
  const persisted = await snapshot(fixtures);
  assert.deepEqual(persisted, checkpoint, 'Reopening four proposal states must not create a decision, notice, quote or balance');
  const actors = [await signIn('p@example.test'), await signIn(secondEmail), await signIn('d@example.test')];
  const outsider = await signIn('outsider@example.test');
  for (const record of persisted) {
    const fixture = fixtures[record.kind];
    assert.equal(before.records.find((item) => item.kind === record.kind).proposalId, record.proposalId);
    for (const [index, actor] of actors.entries()) {
      const review = await call('getTripChangeReview', actor, { tripId: record.tripId, proposalId: record.proposalId });
      assert.equal(review.status, record.status); assert.equal(review.applied, false);
      assert.equal(review.acceptedParentCount, record.kind === 'partial' ? 1 : 0); assert.equal(review.parentCount, 2);
      if (index < 2) {
        assert.deepEqual(review.bookingIds, [fixture.bookingIds[index]]); assert.equal(review.proposalRequestId, null);
        assert(!Object.hasOwn(review, 'parentUserIds') && !Object.hasOwn(review, 'decisions'));
        assert.equal(review.canRespond, record.kind === 'pending' || (record.kind === 'partial' && index === 1));
      }
    }
    await denied('getTripChangeReview', outsider, { tripId: record.tripId, proposalId: record.proposalId }, 'PERMISSION_DENIED');
  }
  const captureFiles = recoveryKinds.map((kind) => `local-trip-consent-recovery-${kind}.png`);
  for (const name of captureFiles) {
    const image = readFileSync(resolve(directory, name));
    assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-trip-consent-recovery-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    testCount: 4, nativeCaseCount: 2, steps: recoveryKinds.map((kind) => ({ id: `trip-consent-${kind}-restart-ui`, status: 'passed' })),
    native: { before, stopped, after }, checkpoint, persisted, captureFiles,
    recordsUnchanged: true, parentViewsScoped: true, outsiderDenied: true, applicationExercised: false,
    routeProviderExercised: false, paymentExercised: false, fullAppReplay: false,
    limitation: 'Pending, partial, refused and withdrawn price proposals after a new process only; terminal proposals have no history entry in the app. No unsent drafts, application, real routes/payments or physical-device proof.' };
  save(directory, 'trip-consent-recovery-ui-stage.json', result);
  return result;
}
