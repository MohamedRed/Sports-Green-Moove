import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { supportFollowupPhonePhases, verifySupportFollowupCheckpoint } from './manual-support-followup-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const supportFollowupReviewedImages = {
  'inbox-received': 'ae33b4d86411b9a7ab1a6a78199440efd53309e4139b4eb8fa8f6730f75f2c7e',
  awaiting: 'a97e101908311f0922b8c341281468514fee46b084db1b53feac9eedd27acba9',
  answered: 'c13b5a5dbc4a217f88e71d718cb66c413f863307557e17658a8ad3eaa58b0bd2',
  closed: '8dd556fbd405db799ee6cd94bf8f650ff1eea1fe175c95776b9cb580eed8c093',
  reopened: 'ec992470060b8d2d3d872ca1ba4ecfcc5b5663fe5d41fc9f6bbc7bb10b64b328',
  'driver-profile': '70a20cc6c08ac27eca5f947f875f99032f92dc90d216e9a84272def226b456fe',
  foreign: 'c44dce4c032a813c051786a7f65487a27e60225fa43a122d1788f6008013184d',
  'restored-parent-profile': 'bfb909144644b47dc77cdcefdea5e4efb216f0b0c3fd69f287d13bc8b50f475e',
  restored: '369f8666bde6fb8ab164dfb5294f9c4bfe6baca49abe402858ee8e459e88f93b',
};
export function validateSupportFollowupPhone(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  const run = json('results.json'), session = json('session-results.json'), observation = json('captures/phone-observation.json');
  assert.equal(run.scope, 'physical-android-written-support-replies-with-isolated-services');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, 'e7019cb20312a44c95c79fb7954b60ad');
  assert.equal(run.runId, session.runId); assert.equal(run.testedAt, session.testedAt);
  assert.equal(run.testedAt.slice(0, 10), '2026-10-22');
  assert.equal(run.appSourceCommit, 'e23809aca59def492636e7ad0a93f7df5e3b6ecd');
  assert.equal(run.appSha256, '275e20fb98b32613eb8331526a496b2bf7f494f5b88431bd9cb5b1f8f6a3b6d1');
  assert.equal(run.appSha256, observation.appSha256); assert.equal(run.appSourceCommit, observation.appSource);
  assert.deepEqual(run.device, { provider: 'BrowserStack App Live', model: 'Google Pixel 9', os: 'Android 15' });
  for (const key of ['completed', 'physicalDevice', 'manualNativeUiObserved', 'submissionViaPhone', 'requesterResponseVerified',
    'requesterStatusVerified', 'accountIsolationObserved', 'reopeningObserved']) assert.equal(run[key], true, key);
  for (const key of ['adminResponseUiVerifiedOnPhone', 'processRestartVerified', 'pushDeliveryVerified', 'productionWrites',
    'releaseComplete', 'videoCaptured', 'nativePngExportObtained']) assert.equal(run[key], false, key);
  assert.equal(run.independentCheckpoints, 8); assert.equal(run.protectedRecordCount, 158); assert.equal(run.adminResponsesViaService, 2);
  assert.equal(session.scope, 'independent-support-followup-record-checkpoints-not-phone-ui-proof');
  assert.equal(session.completed, true); assert.equal(session.adminClientClosed, true);
  assert.equal(session.fixtureEnvironmentDestroyed, false); assert.equal(session.processIdentityVerified, false);
  assert.equal(session.productionWrites, false); assert.equal(session.pushDeliveryVerified, false);
  assert.equal(session.checkpoints.length, 8); assert.equal(session.receipts.length, 2);
  let reportId, createdAt, previousAt = 0, previousUpdate = 0;
  for (const [index, phase] of supportFollowupPhonePhases.entries()) {
    const checkpoint = json(phase + '.json'); assert.equal(checkpoint.runId, run.runId);
    assert.equal(checkpoint.fixture.parentUid, 'sgm-qa-parent'); assert.equal(checkpoint.fixture.adminUid, 'sgm-qa-admin');
    assert.equal(checkpoint.fixture.foreignUid, 'sgm-qa-driver');
    assert.equal(checkpoint.originalClaimsUnchanged, true); assert.equal(checkpoint.protectedRecordCount, 158);
    assert(Date.parse(checkpoint.recordedAt) > previousAt); previousAt = Date.parse(checkpoint.recordedAt);
    assert.deepEqual(checkpoint.result, verifySupportFollowupCheckpoint(phase, checkpoint.state, checkpoint.fixture));
    assert.deepEqual(session.checkpoints[index], checkpoint.result);
    if (checkpoint.result.reportId) {
      reportId ??= checkpoint.result.reportId; assert.equal(checkpoint.result.reportId, reportId);
      const report = checkpoint.state.reports[0];
      for (const key of ['createdAt', 'updatedAt']) {
        assert(Number.isInteger(report[key]._seconds) && report[key]._seconds > 0);
        assert(Number.isInteger(report[key]._nanoseconds) && report[key]._nanoseconds >= 0 && report[key]._nanoseconds < 1e9);
      }
      createdAt ??= report.createdAt; assert.deepEqual(report.createdAt, createdAt);
      const updated = report.updatedAt._seconds * 1000 + report.updatedAt._nanoseconds / 1e6;
      assert(updated >= previousUpdate); previousUpdate = updated;
      const count = checkpoint.result.replyCount;
      assert.equal(checkpoint.adminResponsesViaService, count);
      assert.deepEqual(checkpoint.fixture.replyIds, session.receipts.slice(0, count).map(row => row.replyId));
    }
  }
  assert(Date.parse(run.testedAt) >= previousAt);
  for (const receipt of session.receipts) { assert.equal(receipt.reportId, reportId); assert.equal(receipt.reused, false); }
  for (const [file, digest] of Object.entries(session.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), digest, file);
  const cleanup = json('cleanup.json'), disposal = json('disposal.json');
  for (const key of ['phoneSessionStopped', 'phoneAppUninstallConfirmedByProvider', 'hostClipboardRestored', 'credentialDiscarded',
    'fixtureEnvironmentDestroyed']) assert.equal(cleanup[key], true, key);
  assert.equal(cleanup.independentPackageInventoryRead, false); assert.equal(cleanup.devicePolicyChanged, false);
  assert.equal(disposal.runId, run.runId); assert(Object.values(disposal.removed).every(value => value === true));
  assert.equal(disposal.backendExitCode, 130); assert.equal(disposal.helperExitCode, 130); assert.equal(disposal.helperProcessGroupExitVerified, true);
  assert.deepEqual(disposal.ports, { host: '127.0.0.1', ports: [5001, 8080, 9000, 9099, 45690, 45691], closed: true });
  assert.match(bytes('captures/uninstall-state.txt').toString(), /Succesfully uninstalled your app/);
  assert.match(bytes('captures/session-stopped-state.txt').toString(), /Title: "App Live Dashboard"/);
  assert.equal(observation.recording.completed, false); assert.equal(observation.nativeScreenshotExport.completed, false);
  assert.equal(observation.processIdentityVerified, false); assert.equal(observation.temporaryDevicePolicyChanged, false);
  assert.equal(observation.appUninstallObserved, true); assert.equal(observation.sessionStoppedObserved, true);
  const times = json('captures/capture-times.json');
  assert.deepEqual(Object.keys(run.publishedCaptures), Object.keys(supportFollowupReviewedImages).map(name => 'support-followup-phone-' + name));
  for (const [name, digest] of Object.entries(supportFollowupReviewedImages)) {
    const file = 'captures/' + name + (name === 'restored' ? '-context' : '') + '.jpg';
    assert.equal(run.publishedCaptures['support-followup-phone-' + name], file);
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), digest, name);
    assert(Date.parse(times[name]) <= Date.parse(run.testedAt));
    const image = imageSize(bytes(file)); assert.equal(image.type, 'jpg');
    assert.equal(image.width, name === 'restored' ? 1440 : 250); assert.equal(image.height, name === 'restored' ? 722 : 562);
    const context = imageSize(bytes('captures/' + name + '-context.jpg')); assert.equal(context.width, 1440); assert.equal(context.height, 722);
  }
  assertEvidenceBundleChecksums(base); return run;
}
