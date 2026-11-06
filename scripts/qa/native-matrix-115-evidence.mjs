import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {expectedSteps} from './native-matrix-964-evidence.mjs';
import {matrixPackages} from './android-case-apks.mjs';

export const matrix115Folder = 'docs/release/evidence/native-matrix-115fee1-2026-11-06';
export const matrix115Identity = {source: '115fee1aa9a0427100b816f1e25a74fcc25cf13c', run: 42296065434,
  job: 128161495576, artifact: 13544250798, bytes: 33919894,
  sha256: '746151ef603570f70e3f68c9d7754bf2d05a70e801575e0c3dddb2282706f0ff'};
const sha = value => createHash('sha256').update(value).digest('hex');

export function validateMatrix115Evidence(root) {
  const base = resolve(root, matrix115Folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const report = json('summary.json'), hashes = json('artifact-sha256.json'), identity = matrix115Identity;
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[A-Za-z0-9#_.\/-]+$/); assert(!file.startsWith('/') && !file.split('/').includes('..'));
    assert.equal(sha(bytes(file)), hash, file);
  }
  const archive = json('original-archive.json'), artifact = json('artifact-metadata.json'), run = json('native-run.json');
  assert.equal(archive.bytes, identity.bytes); assert.equal(archive.sha256, identity.sha256);
  assert.equal(archive.artifactId, identity.artifact); assert.equal(artifact.id, identity.artifact);
  assert.equal(artifact.size_in_bytes, identity.bytes); assert.equal(artifact.digest, 'sha256:' + identity.sha256);
  assert.equal(artifact.workflow_run.head_sha, identity.source); assert.equal(artifact.workflow_run.id, identity.run);
  assert.equal(run.headSha, identity.source); assert.equal(run.databaseId, identity.run);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  const job = run.jobs.find(row => row.databaseId === identity.job);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  for (const name of ['Run Android Compose UI tests', 'Finish bounded read-only full-matrix host observation', 'Upload Android instrumentation reports'])
    assert.equal(job.steps.find(row => row.name === name).conclusion, 'success');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('/ Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const members = new Set();
  for (const row of archive.members) {
    assert(!members.has(row.file)); members.add(row.file); assert(Object.hasOwn(hashes, row.file));
    assert.equal(bytes(row.file).length, row.bytes); assert.equal(sha(bytes(row.file)), row.sha256);
  }
  for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'ordinary-tests.xml', 'ordinary-process.json',
    'replay-results.json', 'suite-status.json', 'device-setup.json', 'device-restoration.json', 'host-exit.json',
    'matrix-manifest.json', 'capture-collection.json', 'replay-stopped.json']) assert(members.has(file), file);
  for (const file of ['summary.json', 'original-archive.json', 'artifact-metadata.json', 'native-run.json']) assert(Object.hasOwn(hashes, file));
  assert.deepEqual(json('suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString()), ordinary = json('ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(ordinary[key], value);
  assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [354, 299, 55, 0]);
  const xml = new XMLParser({ignoreAttributes: false}).parse(bytes('ordinary-tests.xml')).testsuite;
  assert.deepEqual([Number(xml['@_tests']), Number(xml['@_failures']), Number(xml['@_skipped'])], [354, 0, parsed.skipped]);
  assert.deepEqual(xml.testcase.map(row => [row['@_classname'], row['@_name']]), parsed.cases.map(row => [row.className, row.name]));
  const process = json('ordinary-process.json');
  assert.equal(process.status, 0); assert.equal(process.signal, null); assert.equal(process.errorCode, null);
  assert(process.elapsedMs > 0 && process.elapsedMs < 720000);
  const replay = json('replay-results.json'), setup = json('device-setup.json');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40);
  assert.deepEqual(replay.steps, expectedSteps.map(id => ({id, status: 'passed'})));
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  assert.deepEqual(Object.fromEntries(json('matrix-manifest.json').copies.map(row => [row.applicationId, row.sha256])), setup.apkHashes);
  assert.deepEqual(Object.keys(setup.apkHashes).sort(), Object.keys(matrixPackages).sort());
  for (const prep of [ordinary.preparation, replay.matrixPreparation]) {
    assert.deepEqual(prep.apkHashes, setup.apkHashes); assert.equal(prep.receiptSha256, sha(bytes('device-setup.json')));
    assert.equal(prep.installationsRemainedBlocked, true);
  }
  const transcripts = [...members].filter(name => name.startsWith('instrumentation/')); assert.equal(transcripts.length, 32);
  let count = 0;
  for (const file of transcripts) {
    const text = bytes(file).toString(), matches = [...text.matchAll(/OK \((\d+) tests?\)/g)]; assert.equal(matches.length, 1);
    const cases = Number(matches[0][1]); assertInstrumentationPassed(text, cases); count += cases;
  }
  assert.equal(count, 40);
  const stopped = json('replay-stopped.json'); assert.equal(stopped.scope, 'ordinary-matrix-process-stop-not-flow-proof');
  assert.deepEqual(stopped.packages.map(row => [row.packageName, row.afterCount]), [
    ['be.sportgreenmoove.app', 0], ['be.sportgreenmoove.app.test', 0]]);
  const copies = [...members].filter(name => name.startsWith('copies/')); assert.equal(copies.length, 17);
  for (const file of copies) {
    const copy = json(file); assert.equal(copy.runId, replay.runId); assert.equal(copy.completed, true);
    assert.equal(copy.status, 0); assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert.match(copy.stdout + '\n' + copy.stderr, /[1-9]\d* files? pulled, 0 skipped\.[^\n]*\([1-9]\d* bytes in/);
  }
  const restore = json('device-restoration.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const host = json('host-exit.json'); assert.equal(host.targetExitObserved, true); assert.equal(host.finalState, 'gone');
  assert.equal(host.processSignalsRequested, false); assert.equal(host.deviceCommandsRequested, false);
  assert.equal(json('capture-collection.json').ok, true); assert.equal(json('capture-collection.json').ordinaryPassed, true);
  assert.equal(report.sourceCommit, identity.source); assert.equal(report.wholeWorkflowPassed, true);
  for (const key of ['currentHeadAccepted', 'physicalDeviceAccepted', 'rootCauseConfirmed', 'safetyAuditAccepted', 'releaseComplete']) assert.equal(report[key], false);
  return report;
}
