import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { imageSize } from 'image-size';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { ridePhonePhases, verifyRidePhoneCheckpoint } from './manual-ride-phone-checkpoints.mjs';

export function validateRideCompletionRecheck(root, record) {
  const base = dirname(resolve(root, record.source));
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const report = json('summary.json'), run = json('native-run.json');
  assert.equal(record.checkedAt, report.checkedAt);
  assert.equal(report.scope, 'completed-native-replay-and-physical-ride-ui-with-isolated-data');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.headSha, 'fa0cc1ffb94f7cba46b57f7dd04c354d2fb0e264');
  assert.equal(run.databaseId, 39971115386); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(run.jobs.find(job => job.databaseId === 120473728871).conclusion, 'success');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const metadata = json('artifact-metadata.json'); assert.equal(metadata.id, 12510359398);
  assert.equal(metadata.workflow_run.head_sha, run.headSha); assert.equal(metadata.expired, false);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const suite = new XMLParser({ignoreAttributes: false, isArray: tag => tag === 'testcase'}).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '197'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite['@_skipped'], '50'); assert.equal(suite.testcase.length, 197);
  assert.equal(suite.testcase.filter(test => Object.hasOwn(test, 'skipped')).length, 50);
  const replay = json('native/results.json'); assert.equal(replay.testCount, 36); assert.equal(replay.nativeCaseCount, 38);
  assert.equal(replay.steps.length, 36); assert(replay.steps.every(step => step.status === 'passed'));
  assert.equal(replay.chatNetwork.networkRestored, true); assert.equal(replay.chatNetwork.duplicateMessages, 0);
  const files = readdirSync(resolve(base, 'native')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  for (const file of transcripts) assertInstrumentationPassed(bytes('native/' + file).toString(), file.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 16);
  for (const file of copies) { const receipt = json('native/' + file); assert.equal(receipt.runId, replay.runId); assert.equal(receipt.completed, true); }
  const restore = json('native-restore.json'); assert.equal(restore.verified, true);
  for (const field of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[field], true);
  assert(Object.values(restore.restoration.installAdmin).every(value => value === true));
  assert.equal(json('native-host-exit.json').finalState, 'gone');
  const session = json('phone/session-results.json'); assert.equal(session.completed, true);
  assert.equal(session.protectedRecordCount, 158); assert.equal(session.adminClientClosed, true);
  assert.deepEqual(session.checkpoints.map(row => row.phase), ridePhonePhases);
  for (const phase of ridePhonePhases) {
    const checkpoint = json('phone/' + phase + '.json');
    assert.equal(checkpoint.runId, session.runId); assert.equal(checkpoint.protectedRecordCount, 158);
    assert.equal(checkpoint.originalClaimsUnchanged, true);
    assert.deepEqual(verifyRidePhoneCheckpoint(phase, checkpoint.state, checkpoint.fixture), checkpoint.result);
  }
  const cleanup = json('cleanup.json');
  for (const field of ['credentialsRemoved', 'helperDirectoryRemoved', 'phoneSignedOutObserved', 'phoneSessionStoppedObserved']) assert.equal(cleanup[field], true);
  assert.equal(cleanup.uninstallVerified, false); assert.equal(cleanup.phonePolicyChanged, false);
  assert.deepEqual(cleanup.portsClosed, [5001, 8080, 9000, 9099, 45690, 45691]);
  for (const key of ['fullCiPassed', 'physicalPhoneUiPassed', 'phoneAccountsSequential']) assert.equal(report[key], true);
  for (const key of ['physicalTrackingAccepted', 'productionWrites', 'realPaymentExercised', 'releaseComplete',
    'earlierTransportRootCauseConfirmed', 'bookingDecisionPerformedOnPhone', 'videoAccepted']) assert.equal(report[key], false);
  assert.equal(report.phoneCheckpointsPassed, 7); assert.equal(report.confirmedDistanceKm, null);
  assert.equal(report.baselineRecordsUnchanged, 158); assert.equal(report.screenshots.length, 8);
  for (const phase of report.screenshots) {
    const size = imageSize(bytes('captures/' + phase + '.jpg'));
    assert.equal(size.width, 254); assert.equal(size.height, 559); assert.equal(size.type, 'jpg');
  }
  assertEvidenceBundleChecksums(base);
  return report;
}
