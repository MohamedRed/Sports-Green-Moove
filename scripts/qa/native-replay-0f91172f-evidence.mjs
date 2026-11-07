import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeReplay0f91172f(root, record) {
  const base = dirname(resolve(root, record.source));
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = json('summary.json'), run = json('native-run.json');
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.scope, 'completed-isolated-native-replay-not-root-cause-or-release');
  assert.equal(run.headSha, '0f91172f5340ae77696afda54d60ac923a3506a9'); assert.equal(run.headSha, report.sourceCommit);
  assert.equal(run.databaseId, 39999878585); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(run.jobs.find(job => job.databaseId === 120572889288).conclusion, 'success');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success')); assert.equal(report.focusedJobsPassed, 11);
  const metadata = json('artifact-metadata.json'); assert.equal(metadata.id, 12521969524);
  assert.equal(metadata.workflow_run.head_sha, run.headSha); assert.equal(metadata.expired, false);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const suite = new XMLParser({ignoreAttributes: false, isArray: tag => tag === 'testcase'}).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '204'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0'); assert.equal(suite['@_skipped'], '50');
  assert.equal(suite.testcase.length, 204); assert.equal(report.ordinaryCasesPassed, 154); assert.equal(report.ordinaryCasesSkipped, 50);
  const replay = json('native/results.json'); assert.equal(replay.runId, '41d1d40c39949e5360b25d6e7153b310');
  assert.equal(replay.testCount, 36); assert.equal(replay.nativeCaseCount, 38); assert.equal(replay.steps.length, 36);
  assert(replay.steps.every(step => step.status === 'passed')); assert.equal(report.nativeGroupsPassed, 36); assert.equal(report.nativeCasesPassed, 38);
  const files = readdirSync(resolve(base, 'native')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  for (const file of transcripts) assertInstrumentationPassed(bytes('native/' + file).toString(), file.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 16); assert.equal(report.primaryCopiesPassed, 16);
  for (const file of copies) { const row = json('native/' + file); assert.equal(row.runId, replay.runId); assert.equal(row.completed, true); assert.equal(row.status, 0); }
  const restore = json('device-restoration.json'); assert.equal(restore.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  assert(Object.values(restore.restoration.installAdmin).every(value => value === true));
  const host = json('host-observation.json'); assert.equal(host.finalState, 'gone'); assert.equal(host.targetExitObserved, true);
  for (const key of ['fullCiPassed', 'deviceRestorationVerified', 'hostExitVerified']) assert.equal(report[key], true);
  for (const key of ['earlierTransportRootCauseConfirmed', 'newMediaAccepted', 'physicalTrackingAccepted', 'realPaymentsExercised', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  assertEvidenceBundleChecksums(base);
  return report;
}
