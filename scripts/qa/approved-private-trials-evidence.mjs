import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PNG} from 'pngjs';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {cropPrivateTrialCapture, privateTrialCaptures} from './private-trial-captures.mjs';
import {childPhoneInvitationHash} from './child-account-phone-binding.mjs';
import {assertExactPixelFrames} from '../lib/exact-pixel-frames.mjs';

export const approvedPrivateTrialFolder = 'docs/release/evidence/approved-private-trials-2026-11-02/';
export function assertApprovedPrivateTrialReview(review) {
  assert.equal(review.scope, 'approved-private-child-signup-and-incomplete-simulated-network-diagnostic');
  assert.equal(review.sourceCommit, 'fccd8ef8344275f89591c2fe5e87844ca310c452');
  assert.equal(review.projectId, 'demo-sgm-local-qa'); assert.equal(review.runId, '3e2f29c7fd1d091ddeb2e253f8ec334d');
  assert.equal(review.testedAt, '2026-11-02'); assert.equal(review.phoneModel, 'Google Pixel 9 Pro');
  assert.equal(review.osVersion, '15.0'); assert.equal(review.publicCapturesAdded, 3);
  assert.equal(review.selectedApkSha256, '507c3fa6bb2e9bdc6139162b2cd4d6dd2de1770f876b0dfce7395a8c9c9b8c17');
  for (const key of ['physicalPhoneObserved', 'browserFormReached', 'mismatchRefused', 'childAccountCreated',
    'nativeChildSignInObserved', 'publicCropsReviewed']) assert.equal(review[key], true, key);
  for (const key of ['installedApkIndependentlyHashed', 'parentApprovalProven', 'nativeShareToSignupProven', 'publicSignupDeployed',
    'rootCauseConfirmed', 'networkDiagnosticPassed', 'networkPropertyRestored', 'productionWrites', 'realPayments',
    'requestLoggingEnabled', 'resolveAllUrlsEnabled', 'videoRecorded', 'releaseComplete']) assert.equal(review[key], false, key);
  assert.equal(review.accountCreatedCount, 1); assert.equal(review.redemptionCount, 1); assert.equal(review.mapRequests, 0);
}
export function validateApprovedPrivateTrials(root) {
  const folder = resolve(root, approvedPrivateTrialFolder), bytes = file => readFileSync(resolve(folder, file));
  const read = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = read('review.json'); assertApprovedPrivateTrialReview(review);
  const observations = read('phone/observations.json');
  assert.equal(observations.applicationHead, review.sourceCommit); assert.equal(observations.runId, review.runId);
  assert.deepEqual(observations.observations.map(row => [row.phase, row.userCount, row.invitationStatus, row.redemptionRequests]),
    [['before', 3, 'pending', 0], ['mismatch', 3, 'pending', 0], ['created', 4, 'accepted', 1]]);
  for (const row of observations.observations) {assert.equal(row.parentApprovalCount, 0); assert.equal(row.originalRolesUnchanged, true);}
  const account = read('phone/account-observations/session-results.json');
  assert.equal(account.runId, review.runId); assert.equal(account.completed, false);
  assert.deepEqual(account.checkpoints.map(row => row.phase), ['child-signed-in']);
  for (const key of ['signupProven', 'trackingProven', 'physicalUiProvenByThisReport', 'productionWrites']) assert.equal(account[key], false);
  assert.equal(account.adminClientClosed, true); assert.equal(account.firestoreClientTerminated, true);
  const baseline = read('phone/account-observations/baseline.json');
  assert.match(childPhoneInvitationHash(baseline.baseline, baseline.fixture), /^[a-f0-9]{64}$/);
  assert.equal(read('phone/approval-observer-failure.json').rejectedUnexpectedField, 'invitationHash');
  const preflight = read('preflight/same-origin-browser-check.json');
  assert.equal(preflight.completed, true); assert.equal(preflight.redemptionRequests, 1); assert.equal(preflight.wrongOriginRequests, 0);
  for (const key of ['physicalDevice', 'handlerInjected', 'parentApprovalProven', 'productionWrites']) assert.equal(preflight[key], false);
  for (const prefix of ['phone', 'preflight']) {
    const disposal = read(prefix + '/disposal.json'); assert.equal(disposal.failed, false);
    for (const key of ['processGroupExited', 'isolatedEnvironmentDestroyed', 'privatePhoneSessionAbsent', 'privateSignupInputAbsent'])
      assert.equal(disposal[key], true, key);
    assert.deepEqual(disposal.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001, 4185], closed: true});
  }
  const cleanup = read('phone/disposal-review.json');
  for (const key of ['sessionStopped', 'uninstallAcknowledged', 'helperDirectoryAbsent', 'helperGroupExitVerified', 'privateInputsAbsent',
    'hostClipboardRestored', 'privatePasswordCleared']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.endpoints.closed, true); assert.equal(cleanup.helperExitCode, 130);
  assert.equal(cleanup.independentPackageAbsenceProven, false);
  assert.match(bytes('phone/uninstall-observation.txt').toString(), /Succesfully uninstalled your app\(s\)!/);
  for (const id of privateTrialCaptures) {
    const expected = PNG.sync.read(cropPrivateTrialCapture(bytes('phone/originals/' + id + '.jpg'), id));
    const actual = PNG.sync.read(bytes('phone/captures/' + id + '.png'), {checkCRC: true});
    assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
    assertExactPixelFrames(actual.data, expected.data, expected.width * expected.height * 4);
  }
  const provenance = read('network/provenance.json');
  assert.equal(provenance.sourceCommit, 'b46e0481109f37ff3e88119fd44763dca33e1c04');
  assert.equal(provenance.runId, 41502854405); assert.equal(provenance.jobId, 125474514539);
  assert.equal(provenance.conclusion, 'failure'); assert.equal(provenance.artifactId, 13169511923);
  assert.equal(provenance.artifactSha256, '3b6de46508d37ed4756b4c5aba68a437507e01797cbfa22c3e4af82d3b639c29');
  const zip = bytes('network/original-artifact.zip'); assert.equal(zip.length, provenance.artifactBytes);
  assert.equal(createHash('sha256').update(zip).digest('hex'), provenance.artifactSha256);
  const restoration = read('network/restoration.json');
  for (const key of ['failed', 'testAppsAbsent', 'bootTransitionObserved']) assert.equal(restoration[key], true);
  for (const key of ['restored', 'completed', 'radioSettingsChanged', 'rawLogsRetained', 'flowExecuted', 'rootCauseConfirmed', 'releaseAccepted'])
    assert.equal(restoration[key], false);
  assert.equal(restoration.originalValue, ''); assert.equal(restoration.enabledValue, 'D'); assert.equal(restoration.rebootRequests, 1);
  for (let i = 0; i < 3; i++) {
    const sample = read(`network/sample-${i}.json`); assert.equal(sample.runId, restoration.runId);
    assert.equal(sample.propertiesVerified, true); assert.equal(sample.testAppsAbsent, true);
    const summary = read(`network/sample-${i}/chat-subscriptions-before.json`);
    assert.equal(summary.defaultSubscriptionValid.defaultDataSubId, true);
    assert.equal(summary.defaultSubscriptionValid.activeDataSubId, true);
  }
  const history = read('network/sample-0/chat-default-selection-before.json');
  assert.equal(history.recognizedEventCount, 12); assert.equal(history.lastReadiness.subscriptionsInitialized, true);
  for (const files of [observations.sourceFiles, account.sourceFiles, preflight.sourceFiles,
    read('phone/source-files.json'), read('network/source-files.json')]) assertRetainedSourceFiles(root, files);
  return {childAccountCreated: true, nativeChildSignInObserved: true, parentApprovalProven: false,
    networkDiagnosticPassed: false, networkPropertyRestored: false, releaseComplete: false};
}
