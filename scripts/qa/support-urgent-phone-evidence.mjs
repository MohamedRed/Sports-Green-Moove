import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { urgentPhonePhases, verifyUrgentPhoneCheckpoint } from './manual-support-urgent-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateUrgentPhoneScope(report) {
  assert.equal(report.scope, 'connected-physical-urgent-support-with-actual-management-ui-and-independent-record-checkpoints');
  assert.equal(report.checkedAt, '2026-10-23');
  assert.equal(report.baseCommit, '80c88d0c33b388fcd4d9306137146172c17fe5b8');
  assert.equal(report.nativeSource, '62578bc88532c26b6c47592d9448ecf652f7cfc8');
  assert.equal(report.apkSha256, '10668e27abfc95e19256bb484860efe34770e08a5169c43ab2b605c25630d0fb');
  assert.equal(report.package, 'be.sportgreenmoove.app.local');
  for (const key of ['physicalDevice', 'managementWritesThroughActualUi', 'urgentAlertObservedWithoutReload',
    'oneRequestAndReplyRetainedAcrossAccounts', 'foreignHistoryEmpty']) assert.equal(report[key], true, key);
  for (const key of ['videoRecorded', 'nativeScreenshotExportObserved', 'realEmailSent', 'productionWrites',
    'productionDeployed', 'realNetworkLossVerified', 'fullProcessRestartVerified', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.equal(report.protectedRecordsAtEveryCheckpoint, 158);
  assert.equal(report.publication, 'held-owner-private-audience-not-restored'); return report;
}

export function validateUrgentPhoneEvidence(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = validateUrgentPhoneScope(json('summary.json'));
  const observer = json('checkpoints/session-results.json');
  assert.equal(observer.scope, 'independent-urgent-support-record-checkpoints-not-phone-or-management-ui-proof');
  assert.equal(observer.completed, true); assert.equal(observer.adminClientClosed, true);
  assert.equal(observer.adminWritesByObserver, 0); assert.equal(observer.physicalUiVerifiedByObserver, false);
  assert.equal(observer.realEmailSent, false); assert.equal(observer.productionWrites, false);
  assert.equal(observer.protectedRecordCount, 158);
  assert.deepEqual(observer.checkpoints.map(row => row.phase), urgentPhonePhases);
  let previous = '', original;
  for (const [index, phase] of urgentPhonePhases.entries()) {
    const row = json('checkpoints/' + phase + '.json');
    assert.equal(row.projectId, 'demo-sgm-local-qa'); assert.equal(row.runId, observer.runId);
    assert.equal(row.protectedRecordCount, 158); assert.equal(row.originalClaimsUnchanged, true);
    assert.equal(row.adminWritesByObserver, 0); assert.equal(row.physicalUiVerifiedByObserver, false);
    assert(previous < row.recordedAt); previous = row.recordedAt;
    assert.equal(row.fixture.parentUid, 'sgm-qa-parent'); assert.equal(row.fixture.adminUid, 'sgm-qa-admin');
    assert.equal(row.fixture.foreignUid, 'sgm-qa-driver'); assert.equal(row.fixture.managerUid, 'sgm-qa-club-manager');
    if (phase === 'submitted') original = row.fixture;
    if (original) for (const key of ['reportId', 'originalOperation', 'originalCreatedAt']) assert.deepEqual(row.fixture[key], original[key]);
    assert.deepEqual(verifyUrgentPhoneCheckpoint(phase, row.state, row.fixture), row.result);
    assert.deepEqual(row.result, observer.checkpoints[index]);
  }
  const captures = json('capture-index.json');
  assert.equal(captures.scope, 'unchanged-browser-stream-contexts-and-unscaled-rectangles-not-native-png-exports');
  assert.equal(Object.keys(report.publishedCaptures).length, 5);
  for (const file of Object.values(report.publishedCaptures)) {
    const rect = captures.rectangles.find(row => row.output === file); assert(rect);
    assert.deepEqual([rect.left, rect.top, rect.width, rect.height], [625, 110, 253, 560]);
    const size = imageSize(bytes(file)); assert.equal(size.width, 253); assert.equal(size.height, 560);
    assert(imageSize(bytes(rect.source)).width > size.width);
    assert(captures.captures.some(row => row.file === rect.source && row.capturedAt.startsWith(report.checkedAt)));
  }
  const cleanup = json('cleanup.json');
  for (const key of ['observerClosed', 'phoneSignedOut', 'providerUninstallAcknowledged', 'testAppAbsentFromLauncher',
    'phoneStopSessionObserved', 'supportWorkspaceSignedOut', 'ownedSupportTabClosed', 'helperProcessGroupExitVerified',
    'helperPrivateDirectoryRemoved', 'privateSessionFileRemoved', 'clipboardCredentialReplacedWithSyntheticText']) assert.equal(cleanup[key], true, key);
  for (const key of ['deviceAdministrationChanged', 'networkSettingsChanged', 'storeSettingsChanged', 'physicalSettingsRestorationRequired'])
    assert.equal(cleanup[key], false, key);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.equal(cleanup.supportPreviewExitCode, 130); assert.deepEqual(cleanup.listeningPortsAfterCleanup, []);
  assert.deepEqual(cleanup.checkedPorts, [5001, 8080, 9000, 9099, 5191]);
  const terminal = bytes('originals/16-final-dashboard-state.txt').toString();
  assert.match(terminal, /Succesfully uninstalled/);
  assert.match(terminal, /App Live Dashboard/); assert.doesNotMatch(terminal, /STARTING SESSION|Stop Session/);
  const portal = json('portal-review/checks.json'); assert.equal(portal.length, 20);
  for (const width of [1440, 768, 390, 320]) {
    const rows = portal.filter(row => row.width === width);
    assert.deepEqual(rows.map(row => row.step), [1, 2, 3, 4, 5]);
    for (const row of rows) {
      assert.equal(row.pageWidth, width); assert.equal(row.viewport, width);
      assert(row.images.length >= 3 && row.images.every(image => image.loaded === true));
      assert(row.images.some(image => image.src.startsWith('media/support-urgent-phone-')));
    }
  }
  for (const [file, hash] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), hash);
  assertEvidenceBundleChecksums(base); return report;
}
