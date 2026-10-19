import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { assertNetworkStartReceipt } from '../scripts/qa/network-start-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { validateNativeStartupReport } from '../scripts/qa/native-startup-retained-evidence.mjs';
import { validateRemoteRideStopReport } from '../scripts/qa/remote-ride-stop-evidence.mjs';
import { validateRideObservationReport } from '../scripts/qa/ride-observation-retained-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = resolve(root, 'docs/release/evidence/native-matrix-67ab59c-2026-10-19');
const bytes = (file) => readFileSync(resolve(base, file));
const json = (file) => JSON.parse(bytes(file));
const hashes = json('artifact-sha256.json'), run = json('replay/results.json');
test('the complete source-specific native run preserves original artifacts and all declared source bindings', () => {
  assert.equal(Object.keys(hashes).length, 262);
  for (const [file, expected] of Object.entries(hashes)) {
    assert(!isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), expected, file);
  }
  const files = json('source-sha256.json'); assert.equal(Object.keys(files).length, 108);
  assertRetainedSourceFiles(root, files);
  const native = json('native-run.json');
  assert.equal(native.headSha, '67ab59ca132db1754b3236f97284ce48d5bc022f'); assert.equal(native.conclusion, 'success');
  assert.equal(native.jobs.find((job) => job.name === 'Android native UI tests').conclusion, 'success');
});
test('ordinary execution is 120 passes plus 39 explicit skips, including all eight initial-observation cases', () => {
  const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes('ordinary-suite.xml')).testsuite;
  assert.equal(suite['@_tests'], '159'); assert.equal(suite['@_skipped'], '39');
  assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  const executed = [].concat(suite.testcase).filter((item) => !Object.hasOwn(item, 'skipped'));
  assert.equal(executed.length, 120);
  assert.equal(executed.filter((item) => /Local(InitialNetworkObservation|NetworkStartObservation)Test$/.test(item['@_classname'])).length, 8);
  const status = json('native-suite-status.json');
  for (const key of ['ordinaryTests', 'componentEvidence', 'localReplay']) assert.equal(status[key], 0);
});
test('all 36 existing groups and 38 native replay cases remain present with primary transfers', () => {
  const previous = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/native-matrix-36-2026-10-19/replay/results.json')));
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.testCount, 36); assert.equal(run.nativeCaseCount, 38); assert.deepEqual(run.steps, previous.steps);
  const transcripts = Object.keys(hashes).filter((file) => file.startsWith('replay/') && file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 30);
  let cases = 0;
  for (const file of transcripts) {
    const expected = file.startsWith('replay/LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(bytes(file).toString(), expected); cases += expected;
  }
  assert.equal(cases, 38);
  const pulls = Object.keys(hashes).filter((file) => file.startsWith('replay/adb-pull-')); assert.equal(pulls.length, 16);
  for (const file of pulls) { const r = json(file); assert.equal(r.runId, run.runId); assert.equal(r.completed, true); assert.notEqual(r.phase, 'failure-cleanup'); }
});
test('the actual initial measurement precedes successful handover, offline draft recovery and transport release', () => {
  const network = json('replay/local-chat-network-ui.json');
  assertNetworkStartReceipt(network); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.equal(network.runId, run.runId); assert.equal(network.initialNetwork.wifiRequestRegistered, false);
  assert.equal(network.initialNetwork.cellularRequestRegistered, false);
  assert.deepEqual(network.network.map((record) => record.phase), ['before', 'cellular-ready', 'offline', 'restored']);
  assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  assert.equal(run.chatNetwork.duplicateMessages, 0); assert.equal(run.chatNetwork.messageCount, 2);
});
test('three independent local tracking trials retain execution and disposal without map or physical acceptance', () => {
  for (const [name, report, transcript, validate] of [
    ['ride-observation', 'ride-observation-results.json', 'LocalRideObservationFlowTest', validateRideObservationReport],
    ['native-startup', 'native-startup-results.json', 'LocalNativeTrackingStartupTest', validateNativeStartupReport],
    ['remote-ride-stop', 'remote-ride-stop-results.json', 'LocalRemoteRideStopFlowTest', validateRemoteRideStopReport],
  ]) {
    const r = json(`${name}/${report}`); validate(r); assert.equal(json(`${name}-suite-status.json`).status, 0);
    const raw = bytes(`${name}/${transcript}-instrumentation.txt`); assertInstrumentationPassed(raw.toString(), 1);
    assert.equal(createHash('sha256').update(raw).digest('hex'), r.transcriptSha256);
    const pull = json(`${name}/adb-pull-${name}.json`); assert.equal(pull.runId, r.runId); assert.equal(pull.completed, true);
    assert.equal(r.physicalDevice, false); assert.equal(r.productionWrites, false); assert.equal(r.safetyAuditAccepted, false);
    for (const [file, expected] of Object.entries(r.screenshots))
      assert.equal(createHash('sha256').update(bytes(`${name}/${file}`)).digest('hex'), expected);
  }
  assert.equal(json('ride-observation/ride-observation-results.json').mapMovementVerified, false);
});
test('test-only authority is removed and the separately fixed web shutdown stays bound to its own source', () => {
  const setup = json('disposable-device-setup.json'), restored = json('disposable-store-restore.json');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.deepEqual(restored.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assert.deepEqual(restored.observed.mapsRuntime, setup.mapsRuntime); assert.equal(restored.observed.locationEnabled, true);
  assert.equal(restored.observed.installationsBlocked, true);
  const web = json('web-run-93d1c3d.json');
  assert.equal(web.headSha, '93d1c3d33c11595a43342e884235ddfffd22a007'); assert.equal(web.conclusion, 'success');
  const steps = web.jobs.flatMap((job) => job.steps);
  assert.equal(steps.find((step) => step.name === 'Verify actual isolated UI service interruption cleanup').conclusion, 'success');
});
