import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { matrixPackages } from './android-case-apks.mjs';

export function validatePreinstalledMatrixEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), read = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(read(name)), report = json('summary.json'), run = json('native-run.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'completed-preinstalled-local-matrix-with-separate-sdk-preparation-failure');
  assert.equal(report.sourceCommit, '0af0155c1b888d75346b1a66f7227082bdfab274');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.databaseId, 39868782016);
  assert.equal(report.nativeRunId, run.databaseId); assert.equal(report.matrixJobId, 120137652096); assert.equal(report.focusedJobId, 120137652285);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === 120137652096).conclusion, 'success');
  assert.equal(run.jobs.find(job => job.databaseId === 120137652285).conclusion, 'failure');
  assert.equal(json('artifact.json').id, 12467335123);
  assert.equal(json('artifact.json').workflow_run.head_sha, report.sourceCommit);
  assert.equal(json('artifact.json').workflow_run.id, run.databaseId);
  assert.match(json('artifact.json').digest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0,
    componentEvidence: 0, localReplay: 0});
  const setup = json('disposable-device-setup.json'), ordinary = json('ordinary-results.json'), replay = json('replay-results.json');
  const digest = createHash('sha256').update(read('disposable-device-setup.json')).digest('hex');
  assert.equal(setup.case, 'full-matrix'); assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.deepEqual(Object.keys(setup.apkHashes).sort(), Object.keys(matrixPackages).sort());
  for (const hash of Object.values(setup.apkHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  for (const preparation of [ordinary.preparation, replay.matrixPreparation]) {
    assert.deepEqual(preparation.apkHashes, setup.apkHashes); assert.equal(preparation.receiptSha256, digest);
    assert.equal(preparation.installationsRemainedBlocked, true);
  }
  assert.equal(replay.matrixPreparation.method, 'preinstalled-full-matrix-replay-without-install-window');
  assert.equal(ordinary.preparation.method, setup.scope); assert.equal(ordinary.preparation.case, setup.case);
  assert.equal(ordinary.installationsRemainedBlocked, true); assert.equal(ordinary.physicalDeviceAccepted, false);
  const parsed = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt').toString());
  for (const key of Object.keys(parsed)) assert.deepEqual(ordinary[key], parsed[key]);
  assert.equal(parsed.caseCount, 197); assert.equal(parsed.passed, 147); assert.equal(parsed.skipped, 50); assert.equal(parsed.failed, 0);
  const xml = new XMLParser({ignoreAttributes: false}).parse(read('ordinary-tests.xml')).testsuite;
  assert.equal(Number(xml['@_tests']), 197); assert.equal(Number(xml['@_failures']), 0); assert.equal(Number(xml['@_skipped']), 50);
  assert.equal(xml.testcase.length, 197);
  assert.deepEqual(xml.testcase.map(row => [row['@_classname'], row['@_name']]), parsed.cases.map(row => [row.className, row.name]));
  assert.equal(report.ordinaryCases, parsed.caseCount); assert.equal(report.ordinaryPassed, parsed.passed); assert.equal(report.ordinarySkipped, parsed.skipped);
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.runId, report.matrixRunId);
  assert.equal(replay.testCount, 36); assert.equal(replay.nativeCaseCount, 38); assert.equal(replay.steps.length, 36);
  assert(replay.steps.every(step => step.status === 'passed'));
  let cases = 0;
  const transcripts = readdirSync(resolve(base, 'instrumentation')); assert.equal(transcripts.length, 30);
  for (const name of transcripts) {
    assert.match(name, /^[A-Za-z0-9#-]+-instrumentation\.txt$/);
    const text = read('instrumentation/' + name).toString(), match = /OK \((\d+) tests?\)/.exec(text);
    assert.match(text, /^INSTRUMENTATION_STATUS: sgm_installations_blocked=true\r?\nINSTRUMENTATION_STATUS_CODE: 0/m);
    assert.equal([...text.matchAll(/OK \((\d+) tests?\)/g)].length, 1);
    assert(match); const count = Number(match[1]); assertInstrumentationPassed(text, count); cases += count;
  }
  assert.equal(cases, 38);
  const copies = readdirSync(resolve(base, 'copies')); assert.equal(copies.length, 16);
  for (const name of copies) {
    assert.match(name, /^adb-pull-[a-z-]+\.json$/); const copy = json('copies/' + name);
    assert.equal(copy.runId, replay.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
    assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
  }
  const restored = json('disposable-store-restore.json'); assert.equal(restored.case, 'full-matrix');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true); assert.equal(restored.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  const focusedLog = read('focused-preparation-excerpt.txt').toString(), matrixLog = read('matrix-excerpt.txt').toString();
  assert.match(focusedLog, /Error on ZipFile unknown archive/); assert(!focusedLog.includes('INSTRUMENTATION'));
  assert.match(matrixLog, /Ordinary Android matrix: 147 passed, 50 skipped, 0 failed; 197 cases observed/);
  assert.match(matrixLog, /ENOENT.*host-shutdown/); assert.match(matrixLog, /Read-only CI host observation unavailable/);
  for (const key of ['matrixPassed', 'continuousGuardVerified', 'fourApksPinned', 'restorationVerified']) assert.equal(report[key], true);
  for (const key of ['fullCiPassed', 'focusedCaseExecuted', 'matrixHostObserverExecuted', 'hostProcessExitVerified', 'rootCauseConfirmed',
    'earlierTransportFailureExplained', 'physicalDeviceAccepted', 'safetyAuditAccepted', 'releaseComplete', 'productionWrites']) assert.equal(report[key], false);
  assert.equal(report.localFlowGroupsPassed, 36); assert.equal(report.nativeReplayCasesPassed, cases); assert.equal(report.primaryCopiesPassed, 16);
  assert.deepEqual(report.newCapturesPublished, []);
  const hashes = json('artifact-sha256.json');
  for (const name of ['summary.json', 'native-run.json', 'artifact.json', 'native-suite-status.json', 'disposable-device-setup.json',
    'ordinary-results.json', 'ordinary-instrumentation.txt', 'ordinary-tests.xml', 'replay-results.json', 'disposable-store-restore.json',
    'focused-preparation-excerpt.txt', 'matrix-excerpt.txt', ...copies.map(file => 'copies/' + file),
    ...readdirSync(resolve(base, 'instrumentation')).map(file => 'instrumentation/' + file)]) assert(Object.hasOwn(hashes, name));
  for (const [name, hash] of Object.entries(hashes)) {
    assert(!name.startsWith('/') && !name.includes('..')); assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
  }
  return report;
}
