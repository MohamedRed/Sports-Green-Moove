import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, cpSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {staleCancellationFolder, validateStaleCancellationPhone} from '../scripts/qa/cancellation-stale-phone-evidence.mjs';
import {verifyPeerApproval} from '../scripts/qa/cancellation-stale-phone-checkpoints.mjs';
import {verifyCancellationPhoneCheckpoint, verifyCancellationWithCapacity} from '../scripts/qa/trip-cancellation-phone-checkpoints.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {staleCancellationImages, staleCancellationTour} from '../partner-portal/cancellation-stale-phone.mjs';

const root = new URL('..', import.meta.url).pathname;
const read = file => JSON.parse(readFileSync(new URL('../' + staleCancellationFolder + file, import.meta.url)));
const before = read('records/baseline.json'), peer = read('records/peer-approved.json').state;
const confirmed = read('records/cancellation-confirmed.json').state, report = read('records/session-results.json');

test('the phone refuses a stale preview, refreshes and confirms with eight independent record checkpoints', () => {
  assert.deepEqual(validateStaleCancellationPhone(root), {checkpoints: 8, returnedSeats: 3, newCancellationReceipts: 1,
    cancellationNotices: 2, stalePreviewRejectedOnPhone: true, concurrentTransactionOverlapProven: false, releaseComplete: false});
  assert.deepEqual(verifyPeerApproval(before.baseline, peer, before.fixture),
    {seatsAvailable: 1, newApprovalNotices: 1, newCancellations: 0, protectedRecordsUnchanged: true});
  const result = verifyCancellationWithCapacity('cancellation-confirmed', peer, confirmed, report.reviewedFixture, 1);
  assert.equal(result.returnedSeats, 3);
  assert.throws(() => verifyCancellationPhoneCheckpoint('cancellation-confirmed', peer, confirmed, report.reviewedFixture),
    'The original two-seat protocol must retain its original capacity requirement');
});
for (const [label, mutate] of [
  ['wrong capacity', state => {state.documents.trips.find(row => row.id === before.fixture.tripId).data.seatsAvailable = 2;}],
  ['pending decision', state => {state.documents.bookings.find(row => row.id === before.fixture.pendingBookingId).data.status = 'requested';}],
  ['closed booking rewritten', state => {state.documents.bookings.find(row => row.id === before.fixture.alreadyClosedBookingId).data.status = 'approved';}],
  ['duplicate notice', state => {state.documents.notifications.push(structuredClone(state.documents.notifications.at(-1)));}],
  ['privileged role added', state => {state.claims.find(row => row.uid === before.fixture.driverUid).claims.roleKeys.push('admin');}],
  ['live tracking changed', state => {state.liveTrips = {unexpected: true};}],
]) test('peer approval cannot hide ' + label, () => {
  const changed = structuredClone(peer); mutate(changed);
  assert.throws(() => verifyPeerApproval(before.baseline, changed, before.fixture));
});
for (const key of ['concurrentTransactionOverlapProven', 'twoPhoneExchangeProven', 'peerPhoneUiProven',
  'phoneWireAbortedCodeProven', 'independentPackageAbsenceProven', 'installedBytesIndependentlyVerified',
  'videoRecorded', 'iosUiExecuted', 'releaseComplete']) test('rehashed phone records cannot invent ' + key, t => {
  const temp = mkdtempSync(join(tmpdir(), 'sgm-stale-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = join(temp, staleCancellationFolder);
  cpSync(new URL('../' + staleCancellationFolder, import.meta.url), base, {recursive: true});
  const archive = join(temp, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
  for (const hash of new Set(Object.values({...report.sourceFiles, ...read('handoff-source-sha256.json')})))
    copyFileSync(new URL('../docs/release/evidence/source-archive/' + hash + '.txt', import.meta.url), join(archive, hash + '.txt'));
  const summary = JSON.parse(readFileSync(join(base, 'summary.json'))); summary[key] = true;
  writeFileSync(join(base, 'summary.json'), JSON.stringify(summary));
  const hashes = JSON.parse(readFileSync(join(base, 'artifact-sha256.json')));
  hashes['summary.json'] = createHash('sha256').update(readFileSync(join(base, 'summary.json'))).digest('hex');
  writeFileSync(join(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateStaleCancellationPhone(temp));
});
test('the controller never submits a cancellation and has one explicit peer approval with no automatic retry', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-cancellation-stale-phone-session.mjs', import.meta.url), 'utf8');
  assert(!source.includes("call('cancelTrip'")); assert.equal(source.split("call('approveBooking'").length - 1, 1);
  assert(source.includes("if (phase === 'peer-approved')")); assert(source.includes("save('observed-' + phase"));
  assert(source.includes('phoneWireAbortedCodeProven: false')); assert(source.includes('concurrentTransactionOverlapProven: false'));
});
test('the public portal adds five accurate phone steps without promoting contention or deleting earlier evidence', () => {
  const flow = content.flows.find(row => row.id === 'publication');
  assert.equal(flow.checkedAt, '2026-10-30'); assert.equal(flow.status, 'partial');
  assert.equal(flow.staleCancellationPhone.source, staleCancellationFolder + 'summary.json');
  assert.deepEqual(flow.tour.slice(0, 5), staleCancellationTour);
  assert.deepEqual(flow.images.slice(0, 5), staleCancellationImages);
  for (const row of staleCancellationImages) {
    assert.match(row.alt, /capture de session du 30 octobre/);
    assert.equal(captures[row.file], staleCancellationFolder + 'captures/' + row.file.slice('cancel-stale-phone-'.length) + '-phone.png');
  }
  assert.match(flow.remaining, /simultanées entre deux téléphones/);
  assert.equal(content.updates[0].source, staleCancellationFolder + 'README.md');
  assert.equal(content.updates[1].flow, 'native-startup');
  assert.equal(content.updates[1].source, staleCancellationFolder + 'README.md');
  assert(content.updates.some(row => row.source === 'docs/release/evidence/native-transfer-91c4a09-2026-10-30/README.md'));
  assert.match(content.blockers.find(row => row.id === 'cancellation-race').next, /simultanément entre deux téléphones/);
  assert.doesNotMatch(JSON.stringify(flow), /BrowserStack|Firebase|SDK|Pixel|ABORTED/);
});
