import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bookingNoticeChecks } from './booking-notice-evidence.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const bookingRequestNoticeChecks = [
  'request-commits-one-private-driver-notice-with-booking-and-receipt',
  'request-notice-is-visible-only-in-the-drivers-inbox',
  'request-replay-preserves-one-notice-and-its-confirmed-read-time',
  'concurrent-request-retries-commit-one-booking-receipt-and-driver-notice',
  'conflicting-request-reuse-does-not-change-the-booking-or-notice',
  'separate-fresh-requests-retain-separate-notice-identities',
  'denied-stale-and-abandoned-requests-never-create-a-driver-notice',
  'request-resolution-races-never-leave-an-orphan-or-duplicate-notice',
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateBookingRequestNoticeEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), run = json('services.json'), summary = json('summary.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(record.checkedAt, run.testedAt.slice(0, 10)); assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(summary.scope, 'isolated-booking-request-notices-not-connected-ui-push-or-production');
  assert.equal(summary.baselineCommit, '3413b579ac5c8cb3c5a4a7f172b74aa5ad339d4a');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert.equal(run.scope, 'isolated-booking-request-decision-and-notification-atomicity-not-phone-ui');
  assert.equal(run.completed, true); assert.equal(run.adminClientClosed, true); assert.equal(run.isolatedEnvironmentDestroyed, true);
  assert.equal(run.protectedRecordCount, 158);
  const expected = [...bookingNoticeChecks.slice(0, -1), ...bookingRequestNoticeChecks, bookingNoticeChecks.at(-1)];
  assert.deepEqual(run.steps, expected.map(id => ({id, status:'passed'})));
  assert.deepEqual(run.emulatorEndpoints, {host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  for (const key of ['physicalDevice','nativeUiExecuted','pushDeliveryVerified','paymentExercised','productionWrites']) assert.equal(run[key], false);
  assert.deepEqual(run.observations.slice(3), [
    {actor:'sgm-qa-parent',visibleRequestNotices:0}, {actor:'sgm-qa-driver',visibleRequestNotices:1},
    {actor:'sgm-qa-outsider',visibleRequestNotices:0}]);
  const commits = run.requestNoticeRecords.filter(row => row.kind === 'request-commit');
  assert(commits.length >= 4 && commits.length <= 8); assert.equal(new Set(commits.map(row => row.noticeId)).size, commits.length);
  for (const row of commits) {
    const expectedId = 'bookingDecision_' + digest(JSON.stringify(['bookingRequested',row.bookingId,'sgm-qa-driver']));
    assert.equal(row.noticeId, expectedId); assert.equal(row.notice.type, 'bookingRequested');
    assert.equal(row.notice.sourceId, row.bookingId); assert.equal(row.notice.userId, 'sgm-qa-driver'); assert.equal(row.notice.read, false);
    assert.deepEqual(Object.keys(row.notice).sort(), ['body','createdAt','read','sourceId','title','type','userId']);
    assert.equal(row.notice.title, 'Nouvelle demande de réservation');
    assert.equal(row.notice.body, 'Une nouvelle demande de réservation attend votre réponse.');
    assert(Number.isInteger(row.notice.createdAt._seconds));
    assert.equal(row.booking.tripId, row.tripId); assert.equal(row.booking.status, 'requested');
    assert.equal(row.booking.parentUserId, 'sgm-qa-parent'); assert.equal(row.booking.driverUserId, 'sgm-qa-driver');
    assert.equal(row.seatsAvailable, 4); assert([1,2].includes(row.booking.seats));
    assert.equal(row.receipt.uid, 'sgm-qa-parent'); assert.equal(row.receipt.bookingId, row.bookingId);
    assert.equal(row.receipt.state, 'committed'); assert.match(row.receipt.clientRequestId, /^[a-f0-9-]{36}$/);
  }
  const replays = run.requestNoticeRecords.filter(row => row.kind === 'request-read-replay'); assert.equal(replays.length, 1);
  const replay = replays[0]; assert.equal(replay.bookingId, commits[0].bookingId); assert.equal(replay.noticeId, commits[0].noticeId);
  assert.deepEqual(replay.beforeNotice, replay.afterNotice); assert.equal(replay.beforeNotice.read, true);
  assert(Number.isInteger(replay.beforeNotice.readAt._seconds));
  const {read: isRead, readAt, ...unchanged} = replay.beforeNotice;
  assert.deepEqual({...unchanged, read:false}, commits[0].notice);
  for (const [file, hash] of Object.entries(run.sourceFiles)) {
    assert(!file.split('/').includes('..') && /^(functions\/src|scripts\/qa)\//.test(file));
    assert.equal(digest(read('source/' + file + '.txt')), hash, file);
  }
  assert.match(read('red.txt').toString(), /6 failed \| 9 passed \(15\)/);
  assert.match(read('units.txt').toString(), /436 passed \(436\)/);
  const regression = json('regression.json'); assert.equal(regression.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(regression.steps.length, 24); assert(regression.steps.every(step => step.status === 'passed'));
  assert(regression.steps.some(step => step.id === 'chat-delivery-safety'));
  assert(!read('before-handler.ts.txt').toString().includes('createBookingNotifications'));
  assert(read('source/functions/src/callables/bookingRequests.ts.txt').toString().includes('createBookingNotifications(transaction,'));
  assert(read('red-test.ts.txt').equals(read('source/functions/src/__tests__/booking-request-transaction.test.ts.txt')));
  for (const [key,value] of Object.entries({serviceCasesPassed:20,requestCasesPassed:8,backendUnitCasesPassed:436,
    broaderServiceGroupsPassed:24,protectedRecords:158})) assert.equal(summary[key],value);
  assert.deepEqual(summary.emulatorEndpoints,run.emulatorEndpoints);
  for (const key of ['sourceWasUncommittedDuringTests','redReproducedAgainstBaseline']) assert.equal(summary[key], true);
  for (const key of ['connectedNativeUiAccepted','physicalPhoneAccepted','pushDeliveryAccepted','productionDeployed',
    'productionWrites','newMediaPublished','releaseComplete']) assert.equal(summary[key], false);
  assertEvidenceBundleChecksums(base); return run;
}
