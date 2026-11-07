import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';
import { validateRetainedEmergencyIdentity } from './emergency-identity-retained-evidence.mjs';
import { validateRideObservationReport } from './ride-observation-retained-evidence.mjs';
import { validateNativeStartupReport } from './native-startup-retained-evidence.mjs';
import { validateRemoteRideStopReport } from './remote-ride-stop-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertNetworkStartReceipt } from './network-start-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from './chat-network-evidence.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

const phases = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop'];
export function validateNativeCiProvenance(native, context) {
  assert.equal(String(native.databaseId), context.ciRunId); assert.equal(native.headSha, context.sourceCommit);
  assert.equal(native.status, 'completed'); assert.equal(native.conclusion, 'success');
  const required = ['Android native UI tests', 'Android native unit tests', 'Native UI flow coverage',
    'Android focused safety UI tests / Isolated safety flows'];
  required.push(...phases.map((phase) => 'Android focused safety UI tests / Isolated ' + phase));
  for (const name of required) {
    const matches = native.jobs.filter((job) => job.name === name); assert.equal(matches.length, 1, name);
    assert.equal(matches[0].status, 'completed', name); assert.equal(matches[0].conclusion, 'success', name);
  }
  assert.deepEqual(Object.keys(context.cases), phases);
  for (const phase of phases) {
    assert.match(context.cases[phase].runId, /^[a-f0-9]{32}$/);
    assert.equal(context.cases[phase].report, `${phase}/${phase}-results.json`);
  }
}
export function validateIndependentNativeEvidence(root, relative) {
  const base = resolve(root, relative), read = (file) => readFileSync(resolve(base, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const context = json('retained-context.json');
  assert.equal(context.scope, 'executed-independent-local-safety-and-full-replay-not-release-readiness');
  assert.match(context.sourceCommit, /^[a-f0-9]{40}$/); assert.match(context.ciRunId, /^\d+$/);
  for (const key of ['physicalDevice', 'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted', 'childOwnAccountVerified'])
    assert.equal(context[key], false, key);
  validateNativeCiProvenance(json('native-run.json'), context);
  for (const [phase, validate, transcript] of [
    ['ride-observation', validateRideObservationReport, 'LocalRideObservationFlowTest'],
    ['native-startup', validateNativeStartupReport, 'LocalNativeTrackingStartupTest'],
    ['remote-ride-stop', validateRemoteRideStopReport, 'LocalRemoteRideStopFlowTest'],
  ]) {
    const report = json(context.cases[phase].report); validate(report);
    assert.equal(report.runId, context.cases[phase].runId);
    const original = read(`${phase}/${transcript}-instrumentation.txt`);
    assertInstrumentationPassed(original.toString(), 1); assert.equal(sha(original), report.transcriptSha256);
    const pull = json(`${phase}/adb-pull-${phase}.json`);
    assert.equal(pull.runId, report.runId); assert.equal(pull.phase, phase);
    assert.equal(pull.completed, true); assert.equal(pull.status, 0);
    assert.equal(pull.errorCode, null); assert.equal(pull.signal, null);
    for (const [file, hash] of Object.entries(report.screenshots)) assert.equal(sha(read(`${phase}/${file}`)), hash);
    validateContinuousDeviceEvidence({ setup: json(`${phase}/disposable-device-setup.json`),
      setupBytes: read(`${phase}/disposable-device-setup.json`), restored: json(`${phase}/disposable-device-restore.json`),
      claimed: read(`${phase}/disposable-device-setup.json.claimed`), report });
    assertRetainedSourceFiles(root, report.sourceFiles);
  }
  validateRetainedEmergencyIdentity(root, relative + '/emergency-identity/emergency-identity-results.json');
  for (const phase of phases) assert.equal(json(`${phase}/${phase}-suite-status.json`).status, 0);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite.testcase.length, 167);
  assert.equal(suite.testcase.filter((entry) => Object.hasOwn(entry, 'skipped')).length, 41);
  assert.equal(suite.testcase.filter((entry) => !Object.hasOwn(entry, 'skipped')).length, 126);
  const matrix = json('replay/results.json');
  assert.equal(matrix.scope, 'local-ui-not-physical-device'); assert.equal(matrix.projectId, 'demo-sgm-local-qa');
  assert.equal(matrix.runId, context.mainRunId); assert.equal(matrix.testCount, 36); assert.equal(matrix.nativeCaseCount, 38);
  assert.deepEqual(matrix.steps, JSON.parse(readFileSync(resolve(root,
    'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json'))).steps);
  const transcripts = readdirSync(resolve(base, 'replay')).filter((name) => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  let count = 0;
  for (const file of transcripts) {
    const expected = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read('replay/' + file).toString(), expected); count += expected;
  }
  assert.equal(count, 38);
  const network = json('replay/local-chat-network-ui.json');
  assertNetworkStartReceipt(network); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(network.runId, matrix.runId); assert.equal(matrix.chatNetwork.duplicateMessages, 0);
  const statuses = json('native-suite-status.json');
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(statuses[key], 0);
  const restored = json('disposable-store-restore.json');
  assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.equal(restored.observed.installationsBlocked, true); assert.equal(restored.observed.locationEnabled, true);
  assert.deepEqual(restored.observed.mapsRuntime, json('disposable-device-setup.json').mapsRuntime);
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!isAbsolute(file) && !file.split('/').includes('..')); assert.equal(sha(read(file)), hash, file);
  }
  return context;
}
