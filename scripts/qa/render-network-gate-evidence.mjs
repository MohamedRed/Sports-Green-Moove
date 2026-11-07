import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';

export const renderNetworkGateFolder = 'docs/release/evidence/render-network-gate-48ea950-2026-10-27/';
export function validateRenderNetworkGate(root) {
  const folder = resolve(root, renderNetworkGateFolder); assertEvidenceBundleChecksums(folder);
  const bytes = file => readFileSync(resolve(folder, file)), read = file => JSON.parse(bytes(file));
  const head = '48ea95027c17d432937c73fb88ebbd5b9204a7c1', run = read('original-native-run.json');
  assert.equal(run.headSha, head); assert.equal(run.databaseId, 40413819150);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(row => row.databaseId === 121890949452).conclusion, 'failure');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated '));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const checks = read('original-pr-checks.json'); assert.equal(checks.headRefOid, head);
  assert.equal(checks.statusCheckRollup.length, 25); assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  for (const [conclusion, count] of [['SUCCESS', 19], ['FAILURE', 1], ['SKIPPED', 5]])
    assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === conclusion).length, count);
  const ordinary = read('ordinary-results.json'), parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(ordinary[key], value);
  assert.equal(ordinary.passed, 176); assert.equal(ordinary.failed, 1); assert.equal(ordinary.skipped, 54);
  assert.match(bytes('ordinary-instrumentation.txt').toString(), /Failed waiting for PixelCopy!/);
  assert.deepEqual(ordinary.cases.filter(row => row.status === 'failed').map(row => row.name),
    ['largeTextParentSeesBothVersionsAndAcceptsWithoutApplying']);
  assert.deepEqual(read('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1 });
  const capture = read('original-primary-capture.json');
  assert.equal(capture.scope, 'primary-compose-capture-observation-not-flow-or-root-cause-proof');
  assert.equal(capture.captureName, 'trip-change-parent-review-large-text.png');
  assert.equal(capture.sdkInvocations, 1); assert.equal(capture.primaryOutcome, 'threw');
  assert.equal(capture.errorCategory, 'pixelcopy-callback-wait'); assert.equal(capture.elapsedMs, 1084);
  assert.equal(capture.maxMainQueueDelayMs, 714); assert.equal(capture.observerClosed, true);
  assert.equal(capture.observerMayAffectScheduling, true); assert.equal(capture.imagesWrittenByObserver, false);
  assert.equal(capture.samples.length, 3);
  assert(capture.samples.every(row => row.mainFrames[0].className === 'android.graphics.HardwareRenderer'
    && row.mainFrames[0].methodName === 'nSyncAndDrawFrame'));
  const network = read('original-chat-network-ui.json');
  assert.equal(network.projectId, 'demo-sgm-local-qa'); assert.equal(network.completed, false);
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  for (const key of ['cellularRequestReleased', 'wifiRequestReleased']) assert.equal(network[key], true);
  const before = network.preparationFailure;
  assert.equal(before.backendReachable, true); assert.equal(before.wifiAvailableCallbacks, 1);
  assert.equal(before.cellularAvailableCallbacks, 0); assert.equal(before.hasDefaultDataSubscription, false);
  assert.deepEqual(before.activeInternetTransports, ['wifi']);
  assert.match(bytes('chat-instrumentation.txt').toString(), /Condition still not satisfied after 30000 ms/);
  assert.match(bytes('chat-instrumentation.txt').toString(), /LocalChatNetworkFlowTest.kt:82/);
  assert.deepEqual(read('bootstrap-carrier.json').configChangeSent, [false]);
  assert.deepEqual(read('bootstrap-carrier.json').serviceBoundForNoSimConfig, [true]);
  assert.deepEqual(read('replay-carrier.json').configChangeSent, [true]);
  assert.deepEqual(read('replay-carrier.json').serviceBoundForNoSimConfig, [false]);
  const files = readdirSync(resolve(folder, 'copies')); assert.equal(files.length, 17);
  assert(files.includes('adb-pull-failure-cleanup.json'));
  assert.equal(files.filter(file => file !== 'adb-pull-failure-cleanup.json').length, 16);
  for (const file of files) {
    const copy = read('copies/' + file); assert.equal(copy.runId, network.runId);
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null);
  }
  const cleanup = read('device-restore.json'); assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, true);
  assert.equal(cleanup.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(cleanup.restoration.installAdmin[key], true);
  assertRetainedSourceFiles(root, read('source-sha256.json'));
  return { scope: 'failed-primary-capture-and-network-precondition-not-product-regression',
    ordinaryPassed: 176, ordinaryFailed: 1, allPrimaryCopiesPassed: true, primaryCopyCount: 16,
    failureCleanupCopyPassed: true, networkFailedPhase: 'network-preparation',
    fullGatePassed: false, imageRootCauseEstablished: false, networkRootCauseEstablished: false,
    phoneFlowAccepted: false, releaseAccepted: false, publicMedia: [] };
}
