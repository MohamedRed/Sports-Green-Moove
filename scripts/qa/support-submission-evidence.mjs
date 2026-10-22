import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

const phases = ['unconfirmed', 'restored', 'confirmed', 'storage-error'];
const imageHashes = ['8be35014d109be97f9243e56f5522e0594b3aa20af6fd3ee0daf34e932a1042d',
  '8be35014d109be97f9243e56f5522e0594b3aa20af6fd3ee0daf34e932a1042d',
  'cfc84e76538c5d007a102adb43ec40f104d1a169434b7d2b26268f72364720d3',
  '29258b105941fa6f8b2fd5e2d91455a987e191775751afd16ef26bbd003aab38'];
const checks = ['identity-is-required-and-input-is-bounded-before-write', 'original-acknowledgement-binds-request-and-account',
  'concurrent-identical-retries-create-one-report', 'changed-reuse-never-overwrites-any-submission-field',
  'retry-after-review-preserves-status-private-notes-and-timestamps', 'same-identity-is-account-scoped-and-foreign-account-input-is-denied',
  'urgent-flag-survives-create-read-and-retry-without-claiming-a-call', 'post-commit-disconnect-then-explicit-retry-retains-one-report',
  'submission-operation-and-raw-report-reads-stay-private', 'missing-committed-record-is-refused-without-recreation',
  'new-explicit-identity-can-create-a-new-request-after-confirmation', 'protected-fixtures-and-account-claims-stay-unchanged'];
export function validateSupportSubmissionEvidence(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), hash = file => createHash('sha256').update(bytes(file)).digest('hex');
  const report = json('summary.json'), services = json('services.json');
  assert.equal(report.scope, 'separate-local-service-and-native-component-checks-not-connected-phone-flow');
  assert.equal(report.checkedAt, '2026-10-22'); assert.equal(report.dirtySource, true);
  assert.equal(report.baseCommit, 'f819e9b0399494919a8440e0bed71b03cad46469');
  for (const key of ['fullAppNetworkRecoveryVerified', 'appProcessRestartVerified', 'physicalDevice', 'iosPhysicalUiVerified',
    'urgentEscalationVerified', 'emergencyCallVerified', 'productionDeployed', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.equal(services.scope, 'local-emulated-support-submission-services-not-phone-ui'); assert.equal(services.completed, true);
  assert.equal(services.projectId, 'demo-sgm-local-qa'); assert.equal(services.protectedRecordCount, 19);
  assert.deepEqual(services.checks, checks.map(id => ({ id, status: 'passed' })));
  for (const key of ['nativeUi', 'physicalDevice', 'emergencyCallVerified', 'urgentEscalationVerified', 'productionWrites']) assert.equal(services[key], false);
  assert.equal(services.adminClientClosed, true); assert.equal(services.lostAcknowledgement.length, 2);
  const [first, second] = services.lostAcknowledgement;
  assert.equal(first.upstreamStatus, 200); assert.equal(first.acknowledgementDropped, true); assert.equal(first.commit.matchingOperation, true);
  assert.match(first.commit.reportId, /^[a-f0-9]{64}$/); assert.equal(second.upstreamStatus, 200); assert.equal(second.acknowledgementDropped, false);
  assert.deepEqual(report.services, { source: 'services.json', checks: 12, completed: true, protectedRecordCount: 19 });
  assert.deepEqual(report.components, { executed: 2, transport: 'in-process-simulated-response', narrowRecoveryCase: { widthDp: 320, fontScale: 1.3 },
    persistence: 'real-local-file-store', recreated: 'screen-state-not-app-process', physicalDevice: false });
  for (const [file, method] of [['component-recovery.txt', 'lostAcknowledgementRestoresFrozenUrgentRequestAndRetriesExplicitlyAtNarrowLargeText'],
    ['component-storage.txt', 'storageReadFailureDoesNotOfferAnEmptyEditableSend']]) {
    const text = bytes(file).toString(); assert(text.includes('INSTRUMENTATION_STATUS: test=' + method));
    assert.match(text, /OK \(1 test\)/); assert.match(text, /INSTRUMENTATION_STATUS_CODE: 0/); assert.doesNotMatch(text, /FAILURES|INSTRUMENTATION_FAILED/);
  }
  for (const [file, count] of [['state-tests.xml', 8], ['store-tests.xml', 4]]) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes(file).toString()).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  }
  assert.match(bytes('swift-checks.txt').toString(), /SupportSubmissionChecks passed/);
  assert.equal(json('followup-regression.json').completed, true); assert.equal(json('followup-regression.json').checks.length, 13);
  assert.deepEqual(report.clip, { source: 'recording-original.mp4', start: 10, end: 20, poster: 14, audio: false, speed: 1, recordingOnlyAssertionPauseMs: 1200 });
  assert.equal(hash('recording-original.mp4'), 'e70a3600acb51262de1c996ea5f4ebd1348cf16c87237ddcddff68a9e4ad1bc4');
  const probe = json('recording-probe.json'), video = probe.streams.filter(stream => stream.codec_type === 'video');
  assert.equal(video.length, 1); assert.equal(video[0].width, 720); assert.equal(video[0].height, 1600);
  assert.equal(probe.streams.filter(stream => stream.codec_type === 'audio').length, 0); assert(Number(probe.format.duration) > 20);
  assert.deepEqual(report.images, phases.map(phase => 'images/support-submission-' + phase + '.png'));
  for (const [index, file] of report.images.entries()) {
    assert.equal(hash(file), imageHashes[index]); const size = imageSize(bytes(file));
    assert.equal(size.width, 1080); assert.equal(size.height, 2400);
  }
  for (const [file, expected] of Object.entries(report.sourceFiles)) assert.equal(hash('source/' + file), expected);
  const cleanup = json('cleanup.json');
  for (const key of ['packagesRemoved', 'emulatorStopped', 'ownedAvdRemoved', 'backendPortsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.temporaryAdministrationChanged, false); assert.equal(cleanup.productionWrites, false);
  const prior = json('prior-native-ci.json'); assert.equal(prior.headSha, report.baseCommit); assert.equal(prior.status, 'completed');
  assert.equal(prior.conclusion, 'failure'); assert.match(bytes('prior-native-ci-failure.txt').toString(), /Local evidence collection failed during trip-change-schedule/);
  assertEvidenceBundleChecksums(base); return report;
}
