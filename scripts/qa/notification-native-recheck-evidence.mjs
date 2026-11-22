import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const notificationNativeCases = {
  'be.sportgreenmoove.app.services.AndroidNotificationSettingsTest': [
    'thePermissionReaderUsesTheCurrentSystemAppPermission', 'deniedActivityDoesNotLaunchAnUnrelatedFallback',
    'openingTargetsOnlyThisAppsNotificationSettings', 'missingActivityDoesNotLaunchAnUnrelatedFallback',
  ],
  'be.sportgreenmoove.app.ui.NotificationSettingsFlowTest': [
    'narrowLargeTextKeepsStatusAndOpeningErrorInsideTheControl', 'blockedStatusOpensSettingsWithoutClaimingPermissionWasGranted',
    'resumingRereadsPermissionButPausingDoesNotInventAnUpdate',
  ],
};

export function validateNotificationNativeRecheck(root, record) {
  const base = dirname(resolve(root, record.source));
  const bytes = name => readFileSync(resolve(base, name)), json = name => JSON.parse(bytes(name));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = json('summary.json'), run = json('native-run.json'), metadata = json('artifact-metadata.json');
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.checkedAt, '2026-10-23');
  assert.equal(report.scope, 'executed-notification-components-inside-failed-native-replay-not-push-or-phone');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.headSha, 'c1d2a2ff017b89fe498b2537854dc5a64e6d4a0c');
  assert.equal(run.databaseId, 39988296119); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === 120533132535).conclusion, 'failure');
  assert.equal(metadata.id, 12517786813); assert.equal(metadata.expired, false);
  assert.equal(metadata.workflow_run.head_sha, run.headSha);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const process = json('ordinary-process.json'); assert.equal(process.status, 0); assert.equal(process.errorCode, null);
  const parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  assert.equal(parsed.complete, true); assert.equal(parsed.guardConfirmed, true);
  assert.equal(parsed.caseCount, 204); assert.equal(parsed.passed, 154); assert.equal(parsed.skipped, 50); assert.equal(parsed.failed, 0);
  assert.equal(report.ordinaryCasesPassed, parsed.passed); assert.equal(report.ordinaryCasesSkipped, parsed.skipped);
  assert.deepEqual(json('ordinary-results.json').cases, parsed.cases);
  const suite = new XMLParser({ignoreAttributes: false, isArray: tag => tag === 'testcase'}).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '204'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0'); assert.equal(suite['@_skipped'], '50');
  assert.equal(suite.testcase.length, 204);
  for (const [className, names] of Object.entries(notificationNativeCases)) {
    const actual = parsed.cases.filter(row => row.className === className);
    assert.deepEqual(actual.map(row => row.name).sort(), [...names].sort());
    assert(actual.every(row => row.status === 'passed'));
    const xml = suite.testcase.filter(row => row['@_classname'] === className);
    assert.deepEqual(xml.map(row => row['@_name']).sort(), [...names].sort());
    assert(xml.every(row => !['skipped', 'failure', 'error'].some(key => Object.hasOwn(row, key))));
  }
  const restore = json('device-restoration.json'); assert.equal(restore.verified, true); assert.equal(restore.restored, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  assert(Object.values(restore.restoration.installAdmin).every(value => value === true));
  const host = json('host-observation.json'); assert.equal(host.finalState, 'zombie'); assert.equal(host.targetExitObserved, false);
  assert.equal(report.nativeCasesPassed, 7); assert.equal(report.deviceRestorationVerified, true); assert.equal(report.hostExitVerified, false);
  for (const key of ['fullCiPassed', 'pushDeliveryAccepted', 'actualNotificationSent', 'newPhysicalPhoneTrial', 'iosAccepted',
    'productionWrites', 'realMoneyUsed', 'earlierLoginRootCauseConfirmed', 'releaseComplete']) assert.equal(report[key], false);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 5);
  for (const [file, hash] of Object.entries(sources)) {
    assert(file.startsWith('android/app/src/') && !file.includes('..'));
    assert.equal(createHash('sha256').update(bytes('source/' + file + '.txt')).digest('hex'), hash);
  }
  assertEvidenceBundleChecksums(base);
  return report;
}
