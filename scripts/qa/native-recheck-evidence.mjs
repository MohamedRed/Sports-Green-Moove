import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertNetworkStartReceipt } from './network-start-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from './chat-network-evidence.mjs';

export function validateNativeRecheck(root, relative) {
  const base = resolve(root, relative), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const context = json('retained-context.json'), ci = json('native-run.json');
  assert.equal(context.scope, 'full-local-replay-recheck-not-new-visual-or-physical-proof');
  assert.equal(context.sourceCommit, '588fb21381a5638b19464c499a72e643f2757327');
  assert.equal(context.workflowRunId, 39422026774); assert.equal(context.mainJobId, 118625101626);
  assert.equal(context.runId, '29d7fa79eae57ffcac7cff9b54f24d8b');
  for (const key of ['physicalDevice', 'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted',
    'childOwnAccountVerified', 'fullSearchBookingVerified']) assert.equal(context[key], false);
  assert.deepEqual(context.reviewedNewCaptures, []);
  assert.equal(context.focusedEvidenceScope, 'terminal-ci-jobs-only-not-new-independent-artifact-validation');
  assert.equal(ci.headSha, context.sourceCommit); assert.equal(ci.databaseId, context.workflowRunId);
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'success'); assert.equal(ci.name, 'Native CI');
  assert.equal(ci.event, 'pull_request');
  assert.equal(ci.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39422026774');
  const required = ['Android native UI tests', 'Android native unit tests', 'Native UI flow coverage',
    'Android focused safety UI tests / Isolated safety flows', ...['emergency-identity', 'ride-observation',
      'native-startup', 'remote-ride-stop', 'session-restoration', 'session-disconnect'].map(phase =>
      'Android focused safety UI tests / Isolated ' + phase)];
  for (const name of required) {
    const jobs = ci.jobs.filter(job => job.name === name); assert.equal(jobs.length, 1, name);
    assert.equal(jobs[0].status, 'completed', name); assert.equal(jobs[0].conclusion, 'success', name);
  }
  assert.equal(ci.jobs.find(job => job.name === required[0]).databaseId, context.mainJobId);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '170'); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite.testcase.length, 170);
  assert(suite.testcase.every(item => !Object.hasOwn(item, 'failure') && !Object.hasOwn(item, 'error')));
  assert.equal(suite.testcase.filter(item => Object.hasOwn(item, 'skipped')).length, 44);
  assert.equal(suite.testcase.filter(item => !Object.hasOwn(item, 'skipped')).length, 126);
  assert(!suite.testcase.some(item => item['@_classname'].endsWith('LocalParentSearchBookingTest')));
  const matrix = json('results.json');
  assert.equal(matrix.scope, 'local-ui-not-physical-device'); assert.equal(matrix.projectId, 'demo-sgm-local-qa');
  assert.equal(matrix.runId, context.runId); assert.equal(matrix.testCount, 36); assert.equal(matrix.nativeCaseCount, 38);
  assert.deepEqual(matrix.steps, JSON.parse(readFileSync(resolve(root,
    'docs/release/evidence/native-independent-61dc4cb-2026-10-20/replay/results.json'))).steps);
  assert.equal(matrix.search.method, 'component-ui-with-explicit-fake-gateway'); assert.equal(matrix.search.caseCount, 4);
  const files = readdirSync(base), transcripts = files.filter(name => name.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  let executed = 0;
  for (const file of transcripts) {
    const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(file).toString(), count); executed += count;
  }
  assert.equal(executed, 38);
  const phases = ['guardian-parent-verification', 'emergency-contact', 'team-enrollment', 'booking-response-loss',
    'booking-ui-response-loss', 'ride-emergency', 'trip-change-parent-confirmation', 'trip-change-inputs',
    'trip-change-schedule', 'trip-consent-restart', 'trip-consent-recovery', 'trip-draft-restart',
    'trip-schedule-draft-restart', 'confirmed-restart', 'response-loss', 'network-recovery'];
  assert.deepEqual(files.filter(file => file.startsWith('adb-pull-')).sort(), phases.map(phase => `adb-pull-${phase}.json`).sort());
  for (const phase of phases) {
    const receipt = json(`adb-pull-${phase}.json`);
    assert.equal(receipt.projectId, matrix.projectId); assert.equal(receipt.runId, context.runId); assert.equal(receipt.phase, phase);
    assert.equal(receipt.completed, true); assert.equal(receipt.status, 0); assert.equal(receipt.signal, null); assert.equal(receipt.errorCode, null);
  }
  const network = json('local-chat-network-ui.json');
  assertNetworkStartReceipt(network); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(network.runId, context.runId); assert.equal(matrix.chatNetwork.duplicateMessages, 0);
  const status = json('native-suite-status.json');
  assert.equal(status.scope, 'native-suite-exit-status-not-flow-verification');
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(status[key], 0);
  const restored = json('disposable-store-restore.json');
  assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  for (const key of ['installationsBlocked', 'locationEnabled', 'noActiveStoreInstall']) assert.equal(restored.observed[key], true);
  assert.deepEqual(restored.observed.mapsRuntime, json('disposable-device-setup.json').mapsRuntime);
  const artifact = json('artifact-metadata.json');
  assert.equal(artifact.id, context.artifactId); assert.equal(artifact.id, 12265109077);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 79); assertRetainedSourceFiles(root, sources);
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), files.filter(file => !['artifact-sha256.json', 'README.md'].includes(file)).sort());
  for (const [file, hash] of Object.entries(hashes)) { assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file); }
  return context;
}
