import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {validatePrimaryCaptureDiagnostic} from './primary-capture-diagnostic-schema.mjs';
import {validateRideObservationReport} from './ride-observation-retained-evidence.mjs';
import {validateRemoteRideStopReport} from './remote-ride-stop-evidence.mjs';

export const releaseRecheckFolder = 'docs/release/evidence/release-recheck-b8886ec-2026-10-30/';
export const releaseRecheckHead = 'b8886ec4507303e25b497366d91037082d7109bc';
export function assertReleaseRecheckScope(summary) {
  assert.equal(summary.sourceCommit, releaseRecheckHead);
  assert.equal(summary.scope, 'completed-local-automated-gate-not-physical-or-release-readiness');
  assert.equal(summary.fullEnabledCiPassed, true); assert.equal(summary.supportChecksPassed, 41);
  for (const key of ['releaseComplete', 'physicalDeviceAccepted', 'rootCauseProven', 'productionWrites', 'realEmailSent']) assert.equal(summary[key], false);
  assert.deepEqual(summary.newPublicMedia, []);
}
export function validateReleaseRecheck(root) {
  const base = resolve(root, releaseRecheckFolder), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assertEvidenceBundleChecksums(base); assertReleaseRecheckScope(json('summary.json'));
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  for (const [name, id] of [['native', 41074069057], ['backend', 41074068981], ['web', 41074069270], ['release', 41074069552], ['transport', 41074069365]]) {
    const run = json(name + '-run.json'); assert.equal(run.databaseId, id); assert.equal(run.headSha, releaseRecheckHead);
    assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
    assert(run.jobs.every(row => row.status === 'completed' && ['success', 'skipped'].includes(row.conclusion)));
  }
  const native = json('native-run.json'), artifact = json('main-artifact.json');
  assert.equal(artifact.id, 12987403902); assert.equal(artifact.workflow_run.id, native.databaseId);
  assert.equal(artifact.workflow_run.head_sha, releaseRecheckHead);
  assert.equal(artifact.digest, 'sha256:ea2e098a1fa98315e1117f22e5e296fcbdbcc293c43dc4ebe29b9b05b4e78ead');
  assert.equal(native.jobs.find(row => row.databaseId === 124125441318).conclusion, 'success');
  const focused = native.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const pr = json('pr.json'); assert.equal(pr.headRefOid, releaseRecheckHead); assert.equal(pr.mergeStateStatus, 'CLEAN');
  assert(pr.statusCheckRollup.length > 0);
  assert(pr.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  const parsed = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt').toString()), ordinary = json('ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(ordinary[key], value);
  assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [259, 205, 54, 0]);
  const controlled = parsed.cases.filter(row => row.className.endsWith('.PrimaryCaptureWindowCalibrationTest'));
  assert.equal(controlled.length, 2); assert(controlled.every(row => row.status === 'passed'));
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const replay = json('replay/results.json'), files = readdirSync(resolve(base, 'replay'));
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.projectId, 'demo-sgm-local-qa');
  assert.equal(replay.runId, 'b4e1b85f8e7b5f4262481e48e1a2f93f');
  assert.deepEqual([replay.testCount, replay.nativeCaseCount, replay.steps.length], [37, 40, 37]);
  assert(replay.steps.every(row => row.status === 'passed')); assert(replay.adminClientClosed && replay.firestoreClientTerminated);
  const transcripts = files.filter(file => file.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 32);
  let cases = 0;
  for (const file of transcripts) {const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read('replay/' + file).toString(), count); cases += count;}
  assert.equal(cases, 40);
  const copies = files.filter(file => /^adb-pull-.*\.json$/.test(file)); assert.equal(copies.length, 17);
  const checkCopy = (file, runId) => {const copy = json(file); assert.equal(copy.runId, runId);
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert.notEqual(copy.phase, 'failure-cleanup');};
  for (const file of copies) checkCopy('replay/' + file, replay.runId);
  const setup = json('disposable-device-setup.json'); assert.equal(setup.case, 'full-matrix'); assert.equal(Object.keys(setup.apkHashes).length, 4);
  for (const preparation of [ordinary.preparation, replay.matrixPreparation]) {
    assert.equal(preparation.receiptSha256, sha(read('disposable-device-setup.json')));
    assert.deepEqual(preparation.apkHashes, setup.apkHashes); assert.equal(preparation.installationsRemainedBlocked, true);
  }
  const checkRestore = file => {const restored = json(file); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
    for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restored.restoration[key], true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);};
  checkRestore('disposable-store-restore.json');
  const captures = readdirSync(resolve(base, 'captures')); assert.equal(captures.length, 6);
  for (const file of captures) {const value = json('captures/' + file); validatePrimaryCaptureDiagnostic(value);
    assert.equal(value.schemaVersion, 4); assert.equal(value.primaryOutcome, 'returned'); assert.equal(value.errorCategory, 'none');}
  for (const [name, reportFile, transcript, count, validate, artifactId] of [
    ['ride-observation', 'ride-observation-results.json', 'LocalRideObservationFlowTest-instrumentation.txt', 1, validateRideObservationReport, 12986663039],
    ['remote-ride-stop', 'remote-ride-stop-results.json', 'LocalRemoteRideStopFlowTest-instrumentation.txt', 1, validateRemoteRideStopReport, 12986244019],
    ['team-read-components', 'results.json', 'instrumentation.txt', 3, null, 12987271230],
  ]) {
    const run = json(`${name}/${reportFile}`); validate?.(run); assert.equal(run.physicalDevice, false); assert.equal(run.productionWrites, false);
    const artifact = json(`${name}/artifact.json`); assert.equal(artifact.id, artifactId); assert.equal(artifact.workflow_run.head_sha, releaseRecheckHead);
    assertInstrumentationPassed(read(`${name}/${transcript}`).toString(), count); assert.equal(run.transcriptSha256, sha(read(`${name}/${transcript}`)));
    for (const [file, hash] of Object.entries(run.screenshots)) assert.equal(sha(read(`${name}/${file}`)), hash);
    assertRetainedSourceFiles(root, run.sourceFiles); checkRestore(`${name}/disposable-device-restore.json`);
    assert.equal(json(`${name}/${name}-suite-status.json`).status, 0);
    const copy = readdirSync(resolve(base, name)).filter(file => /^adb-pull-.*\.json$/.test(file)); assert.equal(copy.length, 1);
    checkCopy(`${name}/${copy[0]}`, run.runId);
  }
  let supportChecks = 0;
  for (const [name, count] of [['submission', 12], ['followup', 13], ['urgent', 11]]) {
    const run = json(`support/${name}.json`); assert.equal(run.completed, true); assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.checks.length, count); assert.equal(new Set(run.checks.map(row => row.id)).size, count);
    assert(run.checks.every(row => row.status === 'passed')); assert.equal(run.physicalDevice, false); assert.equal(run.productionWrites, false);
    assert(run.protectedRecordCount > 0); supportChecks += count;
  }
  const browser = json('support/followup.json').browser; assert.equal(browser.scope, 'local-admin-browser-not-requester-native-or-phone');
  assert.equal(browser.checks.length, 5); assert(browser.checks.every(row => row.status === 'passed')); supportChecks += browser.checks.length;
  assert.deepEqual(browser.viewports, [1440, 768, 390, 320]); assert.equal(browser.externalRequests, 0); assert.equal(browser.productionWrites, false);
  assert.equal(browser.screenshots.length, 5); for (const file of browser.screenshots) assert.equal(read('support/images/' + file).subarray(1, 4).toString(), 'PNG');
  assert.equal(json('support/urgent.json').realEmailSent, false); assert.equal(supportChecks, 41);
  assert.match(read('support/swift-checks.txt').toString(), /SportsGreenMooveNativeChecks passed/);
  const closure = json('support/listener-closure.json'); assert.equal(closure.listenersAbsent, true); assert.deepEqual(closure.ports, [9099, 5001, 8080, 9000, 4193]);
  return {ordinaryPassed: 205, ordinarySkipped: 54, replayCases: 40, primaryCopies: 17, focusedJobs: 11, supportChecks, releaseComplete: false};
}
