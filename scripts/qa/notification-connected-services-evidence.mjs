import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationConnectedServices(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = json('summary.json'), service = json('services.json'), run = json('previous-native-run.json');
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.sourceCommit, '87082b10b44db59943089a21f82606f5a153be2b');
  assert.equal(report.scope, 'authenticated-notification-service-checks-and-previous-device-preparation-failure-not-connected-ui');
  assert.equal(service.projectId, 'demo-sgm-local-qa'); assert.equal(service.scope, 'authenticated-local-notification-services-not-native-ui');
  assert.equal(service.completed, true); assert.equal(service.checks.length, 4); assert(service.checks.every(row => row.status === 'passed'));
  assert.equal(service.checkpoint.protectedRecordCount, 167); assert.equal(report.protectedRecordCount, 167);
  for (const key of ['allOtherRecordsUnchanged', 'allClaimsUnchanged', 'liveTripsUnchanged']) assert.equal(service.checkpoint[key], true);
  assert.equal(service.adminClientClosed, true); assert.equal(service.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(service.emulatorEndpoints, {host: '127.0.0.1', ports: [9099,8080,9000,5001], closed: true});
  assert.equal(report.serviceChecksPassed, 4); assert.equal(report.rootTestsPassed, 1821); assert.equal(report.nativeRestartStagesCompiled, 2);
  assert.match(bytes('native-build.txt').toString(), /BUILD SUCCESSFUL/);
  assert.match(bytes('root-tests.txt').toString(), /# tests 1821\r?\n# suites 0\r?\n# pass 1821\r?\n# fail 0/);
  assert.equal(run.databaseId, 40008087430); assert.equal(run.headSha, 'c3403d0c05acbab144e98995cddb08f915f5a36e');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'success');
  const failed = run.jobs.find(job => job.databaseId === 120601047686); assert.equal(failed.conclusion, 'failure');
  assert.equal(failed.steps.find(step => step.number === 9).conclusion, 'failure');
  assert.match(bytes('preparation-excerpt.txt').toString(), /Error on ZipFile unknown archive/);
  for (const key of ['previousFullNativeJobPassed', 'previousFailedJobBeforeAppLaunch']) assert.equal(report[key], true);
  for (const key of ['connectedNativeUiAccepted', 'previousNativeWorkflowPassed', 'downloadFailureRootCauseConfirmed',
    'physicalPhoneAccepted', 'pushDeliveryAccepted', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 8);
  for (const [file, hash] of Object.entries(sources)) {
    assert(!file.includes('..') && !file.startsWith('/'));
    assert.equal(createHash('sha256').update(bytes('source/' + file + '.txt')).digest('hex'), hash);
  }
  assertEvidenceBundleChecksums(base);
  return report;
}
