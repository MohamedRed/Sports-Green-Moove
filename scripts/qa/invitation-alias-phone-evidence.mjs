import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertExactPixelFrames} from '../lib/exact-pixel-frames.mjs';

export const invitationAliasFolder = 'docs/release/evidence/invitation-alias-phone-2026-11-02/';
export const invitationAliasClip = {x: 633, y: 170, width: 237, height: 455};
export const invitationAliasCaptures = ['form-ready', 'mismatch-refused', 'signup-unconfirmed'];
export function cropInvitationSession(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length <= 8 * 1024 * 1024);
  assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);
  const decoded = jpeg.decode(bytes, {formatAsRGBA: true, colorTransform: true,
    tolerantDecoding: false, maxResolutionInMP: 2, maxMemoryUsageInMB: 64});
  assert.equal(decoded.width, 1440); assert.equal(decoded.height, 692);
  const source = new PNG({width: decoded.width, height: decoded.height}); source.data = decoded.data;
  const clip = invitationAliasClip, crop = new PNG({width: clip.width, height: clip.height});
  source.bitblt(crop, clip.x, clip.y, clip.width, clip.height, 0, 0);
  return PNG.sync.write(crop, {colorType: 6});
}
export function assertInvitationAliasReview(review) {
  assert.equal(review.scope, 'physical-phone-private-alias-form-and-mismatch-not-signup-or-root-cause-proof');
  assert.equal(review.sourceCommit, 'd55a112b129f8bf5bfe0bff0f21a929dc9da2596');
  assert.equal(review.projectId, 'demo-sgm-local-qa'); assert.equal(review.testedAt, '2026-11-02');
  assert.equal(review.runId, '426605251d11cf7c5c681ec70b987503');
  assert.equal(review.selectedApkSha256, '507c3fa6bb2e9bdc6139162b2cd4d6dd2de1770f876b0dfce7395a8c9c9b8c17');
  assert.equal(review.browserAlias, 'bs-local.com'); assert.equal(review.approvedExtraLoopbackPort, 4185);
  assert.equal(review.publicCapturesAdded, 3); assert.equal(review.mapRequests, 0);
  for (const key of ['physicalPhoneObserved', 'browserFormReached', 'mismatchRefused', 'browserAliasEnabled',
    'credentialsMaskedInRetainedCaptures', 'publicCropsReviewed']) assert.equal(review[key], true, key);
  for (const key of ['installedApkIndependentlyHashed', 'childAccountCreated', 'parentApprovalProven',
    'nativeShareToSignupProven', 'helperConnectionContinuityProven', 'rootCauseConfirmed', 'productionWrites',
    'realPayments', 'requestLoggingEnabled', 'resolveAllUrlsEnabled', 'videoRecorded', 'releaseComplete'])
    assert.equal(review[key], false, key);
}
export function validateInvitationAliasPhone(root) {
  const folder = resolve(root, invitationAliasFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'); assertInvitationAliasReview(review);
  const observations = json('observations.json'), records = json('connection-blocked-records.json'), disposal = json('disposal.json');
  for (const row of [observations, records, disposal]) {
    assert.equal(row.projectId, review.projectId); assert.equal(row.runId, review.runId);
  }
  assert.equal(observations.applicationHead, review.sourceCommit);
  assert.deepEqual(observations.observations.map(row => row.phase), ['before', 'mismatch']);
  for (const row of observations.observations) {
    assert.equal(row.userCount, 3); assert.equal(row.invitationStatus, 'pending');
    assert.equal(row.redemptionRequests, 0); assert.equal(row.parentApprovalCount, 0);
    assert.equal(row.originalRolesUnchanged, true);
  }
  assert.equal(records.browserFormReached, true); assert.equal(records.accountCount, 3);
  assert.equal(records.invitationStatus, 'pending');
  for (const key of ['redemptionCount', 'approvalRequestCount', 'accountLinkCount']) assert.equal(records[key], 0, key);
  for (const key of ['childAccountExists', 'signupProven', 'parentApprovalProven', 'productionWrites', 'releaseComplete'])
    assert.equal(records[key], false, key);
  assert.deepEqual(records.claims, [
    {uid: 'sgm-qa-club-manager', claims: {roleKeys: ['clubManager', 'parent']}},
    {uid: 'sgm-qa-driver', claims: {roleKeys: ['driver', 'parent']}}, {uid: 'sgm-qa-parent', claims: {roleKeys: ['parent']}},
  ]);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(records[key], true);
  for (const key of ['processGroupExited', 'isolatedEnvironmentDestroyed', 'privatePhoneSessionAbsent', 'privateSignupInputAbsent'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.failed, false);
  assert.deepEqual(disposal.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001, 4185], closed: true});
  const cleanup = json('phone-and-helper-disposal.json');
  for (const key of ['sessionStopped', 'uninstallAcknowledged', 'helperRequestedStop', 'helperGroupExitVerified',
    'helperDirectoryAbsent', 'privateInputsAbsent', 'hostClipboardRestored', 'privateInputListenersClosed']) assert.equal(cleanup[key], true, key);
  for (const key of ['independentPackageAbsenceProven', 'nativeSignInPerformed', 'devicePolicyChanged', 'hostBrowserPermissionChanged'])
    assert.equal(cleanup[key], false, key);
  assert.equal(cleanup.helperExitCode, 130);
  assert.match(bytes('uninstall-observation.txt').toString(), /There has been no change in the accessibility tree/);
  assert.deepEqual(json('uninstall-operator-observation.json'), {
    scope: 'operator-reviewed-live-session-acknowledgement-not-independent-package-proof', observedOn: '2026-11-02',
    message: 'Succesfully uninstalled your app(s)!', savedAxWasDeltaOnly: true,
    savedAxAloneProvesUninstall: false, independentPackageAbsenceProven: false,
  });
  for (const id of invitationAliasCaptures) {
    const expected = PNG.sync.read(cropInvitationSession(bytes('originals/' + id + '.jpg')));
    const actual = PNG.sync.read(bytes('captures/' + id + '.png'), {checkCRC: true});
    assert.equal(actual.width, invitationAliasClip.width); assert.equal(actual.height, invitationAliasClip.height);
    assertExactPixelFrames(actual.data, expected.data, invitationAliasClip.width * invitationAliasClip.height * 4);
  }
  assertRetainedSourceFiles(root, observations.sourceFiles); assertRetainedSourceFiles(root, json('support-source-files.json'));
  return {formReached: true, mismatchRefused: true, accountsCreated: 0, parentApprovalProven: false, releaseComplete: false};
}
