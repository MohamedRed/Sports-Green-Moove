import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {validateMatrix115Evidence, matrix115Folder} from '../scripts/qa/native-matrix-115-evidence.mjs';
import {assertInstrumentationPassed} from '../scripts/qa/android-instrumentation-result.mjs';
import {assertNativeClockStartupMarker} from '../scripts/qa/native-clock-startup-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {nativeMatrix115, nativeRecheckCc1, nativeMatrix115Progress} from '../partner-portal/native-matrix-115.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const later = 'docs/release/evidence/native-recheck-cc1e6d7-2026-11-06/';
const json = file => JSON.parse(readFileSync(resolve(process.cwd(), file)));

test('the complete source-115 Native CI workflow passes without accepting the later failed head', () => {
  const report = validateMatrix115Evidence(process.cwd());
  assert.equal(report.wholeWorkflowPassed, true); assert.equal(report.localFlowGroupsPassed, 37);
  assert.equal(report.nativeReplayCasesPassed, 40); assert.equal(report.currentHeadAccepted, false);
  assert.equal(json(matrix115Folder + '/ordinary-process.json').elapsedMs, 587939);
  const network = json(matrix115Folder + '/replay-results.json').chatNetwork;
  assert.deepEqual([network.messageCount, network.notificationCount, network.duplicateMessages], [2, 2, 0]);
  assert.equal(network.offlineDraftRetained, true); assert.equal(network.parentDraftRestored, true);
});

for (const [file, mutate] of [
  ['summary.json', row => {row.currentHeadAccepted = true;}],
  ['summary.json', row => {row.physicalDeviceAccepted = true;}],
  ['native-run.json', row => {row.conclusion = 'failure';}],
  ['ordinary-process.json', row => {row.errorCode = 'ETIMEDOUT';}],
  ['replay-results.json', row => {row.steps[0].status = 'failed';}],
  ['replay-stopped.json', row => {row.packages[1].afterCount = 1;}],
  ['device-restoration.json', row => {row.restoration.installAdmin.authorizationRemoved = false;}],
  ['host-exit.json', row => {row.targetExitObserved = false;}],
  ['artifact-metadata.json', row => {row.workflow_run.head_sha = '0'.repeat(40);}],
]) test('complete source-115 evidence rejects resealed mutation: ' + file, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-matrix115-unit-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = resolve(root, matrix115Folder); cpSync(resolve(process.cwd(), matrix115Folder), base, {recursive: true});
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value); writeFileSync(path, JSON.stringify(value));
  const hash = name => sha(readFileSync(resolve(base, name))), hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
  hashes[file] = hash(file);
  const archive = JSON.parse(readFileSync(resolve(base, 'original-archive.json'))), member = archive.members.find(row => row.file === file);
  if (member) {
    member.sha256 = hash(file); member.bytes = readFileSync(path).length;
    writeFileSync(resolve(base, 'original-archive.json'), JSON.stringify(archive)); hashes['original-archive.json'] = hash('original-archive.json');
  }
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateMatrix115Evidence(root));
});

test('the later head has a distinct pre-app Wi-Fi failure and a component pass followed by failed primary transfer', () => {
  const report = json(later + 'summary.json');
  for (const row of report.records) assert.equal(sha(readFileSync(resolve(process.cwd(), later, row.file))), row.sha256, row.file);
  for (const row of json(later + 'original-archives.json').members) {
    const bytes = readFileSync(resolve(process.cwd(), later, row.file));
    assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  }
  assert.equal(json(later + 'matrix/network-readiness/outcome.json').failureKind, 'wifi-prerequisite-deadline');
  assert.equal(json(later + 'matrix/network-readiness/outcome.json').testAppsAbsent, true);
  const prefix = later + 'startup/';
  assertInstrumentationPassed(readFileSync(prefix + 'LocalNativeTrackingStartupTest-instrumentation.txt', 'utf8'), 1);
  assertNativeClockStartupMarker(json(prefix + 'local-native-startup-device.json'));
  assert.equal(json(prefix + 'adb-pull-native-startup.json').completed, false);
  assert.equal(json(prefix + 'adb-pull-failure-cleanup.json').completed, true);
  assert.equal(json(prefix + 'disposable-device-restore.json').verified, true);
  const diagnostics = json(prefix + 'adb-sync-native-startup-diagnostics.json');
  assert(diagnostics.observations.filter(row => row.id !== 'storage-service-log').every(row => !row.collected && /device offline/.test(row.stderr)));
  for (const key of ['primaryStartupCopyPassed', 'currentHeadAccepted', 'rootCauseConfirmed', 'physicalDeviceAccepted', 'releaseComplete', 'newMediaPublished'])
    assert.equal(report[key], false);
});

test('the portal retains both original outcomes without claiming physical, latest-head or repeatable success', () => {
  for (const reference of [nativeMatrix115, nativeRecheckCc1]) assert.equal(sha(readFileSync(reference.source)), reference.sha256);
  assert.deepEqual(content.nativeMatrix115, nativeMatrix115); assert.deepEqual(content.nativeRecheckCc1, nativeRecheckCc1);
  const {recent, previous} = partitionUpdates(content.updates);
  assert(recent.some(row => row.source === nativeMatrix115Progress.source));
  assert(previous.some(row => row.source.includes('native-matrix-9640d8b')));
  assert(previous.some(row => row.source.includes('native-cutoff-142-2026-11-06')));
  assert.match(nativeMatrix115Progress.text, /simulation/); assert.match(nativeMatrix115Progress.text, /reste interrompu/);
  assert.doesNotMatch(nativeMatrix115Progress.title + nativeMatrix115Progress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/);
  assert.equal(content.flows.length, 34);
});
