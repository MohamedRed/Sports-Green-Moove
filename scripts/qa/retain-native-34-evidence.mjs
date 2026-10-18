import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { readGuardianParentDevice } from './guardian-parent-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from './chat-network-evidence.mjs';

const [artifactDirectory, destination] = process.argv.slice(2);
assert(artifactDirectory && destination, 'Supply the downloaded 39153239060 artifact and a fresh destination');
const artifact = resolve(artifactDirectory), output = resolve(destination);
assert(!existsSync(output), 'Original evidence cannot be overwritten');
const replay = resolve(artifact, 'outputs/local-ui-evidence/8b6cf41fc1b2f5cb56cc3280630b8712');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const result = read(resolve(replay, 'results.json'));
assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, '8b6cf41fc1b2f5cb56cc3280630b8712');
assert.equal(result.testCount, 34); assert.equal(result.nativeCaseCount, 36); assert.equal(result.steps.length, 34);
assert.equal(new Set(result.steps.map((step) => step.id)).size, 34); assert(result.steps.every((step) => step.status === 'passed'));
const store = resolve(artifact, 'outputs/store-review-screenshots');
assert.deepEqual(read(resolve(store, 'native-suite-status.json')), {
  scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
const restored = read(resolve(store, 'disposable-store-restore.json'));
assert.equal(restored.restored, true); assert.equal(restored.verified, true); assert.equal(restored.observed.locationEnabled, true);
assertChatNetworkReceipt(read(resolve(replay, 'local-chat-network-ui.json')));
assertTransportRequestSetup(read(resolve(replay, 'local-chat-network-ui.json')));
readGuardianParentDevice(replay, result.runId);
const xml = resolve(artifact, 'outputs/androidTest-results/connected/debug/TEST-emulator-5554 - 15-_app-.xml');
const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
  isArray: (name) => name === 'testcase' }).parse(readFileSync(xml, 'utf8')).testsuite;
assert.equal(suite.tests, 135); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 32);
const cases = suite.testcase.filter((item) => item.classname === 'be.sportgreenmoove.app.ui.EmergencyContactFlowTest');
assert.equal(cases.length, 6);
assert(cases.every((item) => !['failure', 'error', 'skipped'].some((key) => Object.hasOwn(item, key))));
const files = new Map([['ordinary-tests.xml', xml]]);
for (const name of readdirSync(replay).filter((name) => name.endsWith('-instrumentation.txt') ||
  (name.endsWith('.json') && !/^chat-(carrier|modem|subscriptions|default-selection)-/.test(name)) || name.startsWith('guardian-parent-') && name.endsWith('.png'))) {
  if (name.endsWith('-instrumentation.txt')) assertInstrumentationPassed(readFileSync(resolve(replay, name), 'utf8'), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  files.set('replay/' + name, resolve(replay, name));
}
for (const name of ['native-suite-status.json', 'disposable-device-setup.json', 'disposable-store-restore.json']) files.set(name, resolve(store, name));
for (const name of ['emergency-editor-narrow.png', 'emergency-editor-narrow-window.png', 'emergency-editor-changed.png', 'emergency-editor-changed-window.png'])
  files.set(name, resolve(store, 'sgm-emergency-contact', name));
for (const [name, path] of files) if (!name.endsWith('.png'))
  assert.doesNotMatch(readFileSync(path, 'utf8'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/, name);
mkdirSync(resolve(output, 'replay'), { recursive: true });
const hashes = {};
for (const [name, path] of files) {
  copyFileSync(path, resolve(output, name)); hashes[name] = createHash('sha256').update(readFileSync(path)).digest('hex');
}
const component = { projectId: null, testedAt: '2026-10-18T18:24:00Z', scope: 'local-native-component-ui-not-physical-device',
  applicationBackendConnected: false, gateway: 'in-memory-fixture', fullAppReplay: false, physicalDevice: false,
  realProviderOutcomesVerified: false, dialerOpened: false, componentSuiteCompleted: true, failures: 0, errors: 0, skipped: 0,
  testCount: cases.length, sourceCommit: '53508fbe5e0925097a66e5f36b1b5925e835c423',
  sourceRun: 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39153239060', sourceSuitePassed: true,
  sourceSuite: { tests: suite.tests, skipped: suite.skipped, failures: suite.failures, errors: suite.errors },
  steps: cases.map((item) => ({ id: item.name, status: 'passed' })) };
writeFileSync(resolve(output, 'contact-component-results.json'), JSON.stringify(component, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(output, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, files: files.size, localGroups: 34, nativeCases: 36, contactComponentCases: cases.length }));
