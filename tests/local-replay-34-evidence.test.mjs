import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { readGuardianParentDevice } from '../scripts/qa/guardian-parent-evidence.mjs';
import { assertChatNetworkReceipt, assertTransportRequestSetup } from '../scripts/qa/chat-network-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const base = new URL('../docs/release/evidence/local-replay-34-2026-10-18/', import.meta.url);
const bytes = (file) => readFileSync(new URL(file.split('/').map(encodeURIComponent).join('/'), base));
const json = (file) => JSON.parse(bytes(file).toString('utf8'));
test('the completed 34-group replay retains original success transcripts and primary collection receipts', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 99);
  for (const [file, hash] of Object.entries(hashes)) {
    const raw = bytes(file); assert.equal(createHash('sha256').update(raw).digest('hex'), hash, file);
    if (!file.endsWith('.png')) assert.doesNotMatch(raw.toString('utf8'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const report = json('replay/results.json');
  assert.equal(report.runId, '8b6cf41fc1b2f5cb56cc3280630b8712'); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.testCount, 34); assert.equal(report.nativeCaseCount, 36); assert.equal(report.steps.length, 34);
  assert(report.steps.every((step) => step.status === 'passed')); assert.equal(new Set(report.steps.map((step) => step.id)).size, 34);
  const transcripts = Object.keys(hashes).filter((file) => file.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 28);
  for (const file of transcripts) assertInstrumentationPassed(bytes(file).toString('utf8'), file.startsWith('replay/LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((file) => file.startsWith('replay/adb-pull-')); assert.equal(copies.length, 13);
  for (const file of copies) { assert.equal(json(file).runId, report.runId); assert.equal(json(file).completed, true); }
  readGuardianParentDevice(fileURLToPath(new URL('replay/', base)), report.runId);
  const network = json('replay/local-chat-network-ui.json'); assertChatNetworkReceipt(network); assertTransportRequestSetup(network);
  assert.deepEqual(json('native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const restore = json('disposable-store-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.mapsRuntime.playServicesVersion, '26.40.32');
  assert.equal(restore.observed.locationEnabled, true); assert.equal(restore.observed.noActiveStoreInstall, true);
});
test('six contact component passes and reviewed captures do not impersonate an actual SDK or dialer replay', () => {
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(bytes('ordinary-tests.xml').toString('utf8')).testsuite;
  assert.equal(suite.tests, 135); assert.equal(suite.skipped, 32); assert.equal(suite.errors, 0); assert.equal(suite.failures, 0);
  const cases = suite.testcase.filter((item) => item.classname.endsWith('.EmergencyContactFlowTest'));
  assert.equal(cases.length, 6); assert(cases.every((item) => !['failure', 'error', 'skipped'].some((key) => Object.hasOwn(item, key))));
  const selected = json('contact-component-results.json');
  assert.equal(selected.testCount, 6); assert.equal(selected.dialerOpened, false); assert.equal(selected.applicationBackendConnected, false);
  assert.equal(selected.sourceCommit, '53508fbe5e0925097a66e5f36b1b5925e835c423');
  assert.deepEqual(selected.steps.map((step) => step.id), cases.map((item) => item.name));
  assert(selected.steps.every((step) => step.status === 'passed'));
  const emergency = content.flows.find((flow) => flow.id === 'emergency-contact'); assert.equal(emergency.status, 'partial');
  assert.equal(emergency.images.filter((image) => image.file.startsWith('emergency-editor-')).length, 2);
  assert(emergency.images.filter((image) => image.file.startsWith('emergency-editor-')).every((image) => image.alt.includes('simulé')));
  assert.notEqual(emergency.ui.source, base + 'contact-component-results.json');
  assert.match(emergency.remaining, /sans appeler/);
  assert.equal(content.flows.find((flow) => flow.id === 'tracking').status, 'untested');
});
