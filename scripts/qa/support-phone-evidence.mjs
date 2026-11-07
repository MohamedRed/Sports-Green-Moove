import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { supportPhonePhases, verifySupportPhoneCheckpoint } from './manual-support-phone-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateSupportPhone(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), run = json('results.json'), session = json('session-results.json');
  assert.equal(run.scope, 'physical-android-support-submission-with-isolated-services');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, session.runId);
  assert.equal(run.testedAt, session.testedAt); assert.equal(run.testedAt.slice(0, 10), '2026-10-22');
  assert.equal(run.appSourceCommit, '458318c3d7e64252d39c9458dd94cf04a06df79a');
  assert.equal(run.appSha256, '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44');
  for (const key of ['completed', 'physicalDevice', 'manualNativeUiObserved', 'submissionViaPhone', 'adminReviewViaService'])
    assert.equal(run[key], true, key);
  for (const key of ['requesterResponseVerified', 'adminReviewUiVerified', 'pushDeliveryVerified', 'productionWrites',
    'releaseComplete', 'videoCaptured', 'nativePngExportObtained', 'processRestartVerified']) assert.equal(run[key], false, key);
  assert.equal(session.completed, true); assert.equal(session.adminClientClosed, true);
  assert.equal(session.requesterResponseVerified, false); assert.equal(session.fixtureEnvironmentDestroyed, false);
  assert.equal(session.protectedRecordCount, 158); assert.equal(session.checkpoints.length, supportPhonePhases.length);
  let reportId, createdAt, previousAt = 0, previousUpdate = 0;
  for (const [index, phase] of supportPhonePhases.entries()) {
    const checkpoint = json(phase + '.json'); assert.equal(checkpoint.runId, run.runId);
    assert.equal(checkpoint.fixture.parentUid, 'sgm-qa-parent'); assert.equal(checkpoint.fixture.adminUid, 'sgm-qa-admin');
    assert.equal(checkpoint.originalClaimsUnchanged, true); assert.equal(checkpoint.protectedRecordCount, 158);
    assert(Date.parse(checkpoint.recordedAt) > previousAt); previousAt = Date.parse(checkpoint.recordedAt);
    assert.deepEqual(checkpoint.result, verifySupportPhoneCheckpoint(phase, checkpoint.state, checkpoint.fixture));
    assert.deepEqual(session.checkpoints[index], checkpoint.result);
    if (checkpoint.result.reportId) {
      reportId ??= checkpoint.result.reportId; assert.equal(checkpoint.result.reportId, reportId);
      const report = checkpoint.state.reports[0];
      for (const key of ['createdAt', 'updatedAt', ...(phase === 'reviewed' ? ['reviewedAt', 'closedAt'] : [])]) {
        assert(Number.isInteger(report[key]._seconds)); assert(Number.isInteger(report[key]._nanoseconds));
        assert(report[key]._seconds > 0 && report[key]._nanoseconds >= 0 && report[key]._nanoseconds < 1e9);
      }
      createdAt ??= report.createdAt; assert.deepEqual(report.createdAt, createdAt);
      const updatedAt = report.updatedAt._seconds * 1000 + report.updatedAt._nanoseconds / 1e6;
      assert(updatedAt >= previousUpdate); previousUpdate = updatedAt;
      assert.equal(checkpoint.adminReviewViaService, phase === 'reviewed');
    }
  }
  for (const [file, digest] of Object.entries(session.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), digest, file);
  const first = json('first-attempt/session-results.json');
  assert.notEqual(first.runId, run.runId); assert.equal(first.completed, false); assert.equal(first.adminReviewViaService, false);
  assert.deepEqual(first.checkpoints.map(row => row.phase), ['prepared', 'invalid']);
  assert.equal(json('first-attempt/invalid.json').state.reports.length, 0);
  for (const [file, digest] of Object.entries(first.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('first-attempt/source/' + file)).digest('hex'), digest, file);
  const cleanup = json('cleanup.json');
  for (const key of ['phoneSessionStopped', 'phoneAppUninstallConfirmedByProvider', 'backendDirectoryRemoved', 'privateSessionRemoved',
    'helperDirectoryRemoved', 'firstAttemptBackendDirectoryRemoved', 'firstAttemptPrivateSessionRemoved',
    'fixtureEnvironmentDestroyed', 'credentialDiscarded', 'hostClipboardRestored']) assert.equal(cleanup[key], true, key);
  for (const key of ['firstAttemptAppUninstallVerified', 'independentPackageInventoryRead', 'devicePolicyChanged']) assert.equal(cleanup[key], false);
  assert.equal(cleanup.backendExit, 130); assert.equal(cleanup.helperExit, 130);
  assert.match(bytes('uninstall-and-stopped-full.txt').toString(), /Succesfully uninstalled your app/);
  assert.match(bytes('phone-stopped.txt').toString(), /Title: "App Live Dashboard"/);
  assert.deepEqual(cleanup.endpoints, { host: '127.0.0.1', ports: [5001, 8080, 9000, 9099, 45690, 45691], closed: true });
  const times = json('capture-times.json'); assert.equal(Object.keys(run.publishedCaptures).length, 4);
  for (const phase of ['invalid', 'filled', 'submitted', 'reopened']) {
    assert.equal(run.publishedCaptures['support-phone-' + phase], phase + '-device.jpg');
    assert(Date.parse(times[phase]) <= Date.parse(run.testedAt));
    const image = imageSize(bytes(phase + '-device.jpg')); assert.equal(image.type, 'jpg');
    assert.equal(image.width, 250); assert.equal(image.height, 562);
    const context = imageSize(bytes(phase + '-context.jpg')); assert.equal(context.width, 1440); assert.equal(context.height, 722);
  }
  assertEvidenceBundleChecksums(base); return run;
}
