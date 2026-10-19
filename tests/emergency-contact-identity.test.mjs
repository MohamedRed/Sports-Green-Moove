import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), base = 'docs/release/evidence/emergency-child-identity-2026-10-19/';
const bytes = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => bytes(path).toString('utf8');
const json = (file) => JSON.parse(text(base + file));
test('the original child recreation exposure stays a negative reproduction without contact values or phone claims', () => {
  const report = json('before.json'); assert.equal(report.scope, 'isolated-security-reproduction-not-passing-emergency-flow');
  assert.equal(report.vulnerableBehaviorReproduced, true); assert.equal(report.childImmutableIdentityChanged, true);
  assert.equal(report.beforeReverification.oldContactReturned, true); assert.equal(report.afterReverification.oldContactReturned, true);
  assert.equal(report.replay.allowed, true); assert.equal(report.productionWrites, false); assert.equal(report.physicalDevice, false);
  assertRetainedSourceFiles(root, report.sourceFiles); assert(!text(base + 'before.json').includes('+12025550123'));
});
test('eleven current identity groups pass while physical and native outcomes remain unaccepted', () => {
  const report = json('services.json'); assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.coverage, 'immutable-child-emergency-contact'); assert.equal(report.checks.length, 11);
  assert.deepEqual(report.steps, report.checks); assert.equal(new Set(report.checks.map((item) => item.id)).size, 11);
  assert(report.checks.every((item) => item.status === 'passed'));
  for (const flag of ['productionWrites', 'physicalDevice', 'nativeUiExecuted']) assert.equal(report[flag], false);
  assertRetainedSourceFiles(root, report.sourceFiles);
});
test('all sixteen baseline groups and the independently verified five-step fixture still pass', () => {
  for (const [file, count] of [['baseline-services.json', 16], ['fixture-services.json', 5]]) {
    const report = json(file); assert.equal(report.checks.length, count); assert(report.checks.every((item) => item.status === 'passed'));
    assert.equal(report.productionWrites, false); assert.equal(report.physicalDevice, false); assert.equal(report.nativeUiExecuted, false);
    assertRetainedSourceFiles(root, report.sourceFiles);
  }
  assert.equal(json('fixture-services.json').verificationPreseeded, false); assert.equal(json('fixture-services.json').fixtureCleanupVerified, true);
});
test('the original Android and Functions reports prove 29 plus eight executed unit passes, not phone UI', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });
  for (const [file, count] of [['wire-unit.xml', 9], ['state-unit.xml', 20]]) {
    const suite = parser.parse(text(base + file)).testsuite; assert.equal(suite.tests, count); assert.equal(suite.testcase.length, count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(suite[key], 0);
  }
  const functions = json('functions-unit.json'); assert.equal(functions.numTotalTests, 8); assert.equal(functions.numPassedTests, 8);
  assert.equal(functions.numFailedTests, 0); assert.equal(functions.success, true);
  assertRetainedSourceFiles(root, json('unit-sources.json').sourceFiles);
});
test('identity, transaction-bound labels, stale writes and legacy denial are required by current source', () => {
  const domain = text('functions/src/domain/emergencyContact.ts'), authority = text('functions/src/services/emergencyContactAuthority.ts');
  for (const guard of ['expectedChildInstanceId', 'createdAt.seconds, createdAt.nanoseconds', 'emergencyDigest([kind, subjectId, childInstanceId])'])
    assert(domain.includes(guard), guard);
  for (const guard of ['atLeast(parsed.data.updatedAt, child.createTime)', 'atLeast(parsed.data.updatedAt, club.createTime)',
    'childName: label(child.get("displayName"))', 'clubName: label(club.get("name"))']) assert(authority.includes(guard), guard);
  const service = text('functions/src/services/emergencyContact.ts');
  assert(service.includes('input.expectedChildInstanceId !== identity.childInstanceId'));
  assert(service.includes('requireNoLegacyChildContact')); assert(service.includes('throw new HttpsError("failed-precondition", "An unbound legacy'));
  assert(!service.includes('transaction.delete('));
});
test('Android binds the displayed identity through write acknowledgement, readback and dial decisions', () => {
  const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
  const gateway = text(base + 'services/FirebaseAndroidEmergencyContactGateway.kt'); assert(!gateway.includes('guardians.guardianView('));
  const wire = text(base + 'services/EmergencyContactWire.kt'); assert(wire.includes('value["clubId"] == target.clubId'));
  assert(wire.includes('instance(it["childInstanceId"]) == instance(operation.expectedChildInstanceId)'));
  const state = text(base + 'ui/EmergencyContactState.kt'); assert(state.includes('requestId(), expected.childInstanceId'));
  assert(state.includes('latest.childInstanceId == expected.childInstanceId')); assert(state.includes('latest.childInstanceId != expected.childInstanceId'));
});
test('every required original artifact remains hash-bound and all three CI paths cover the correction', () => {
  const hashes = json('artifact-sha256.json');
  for (const file of ['before.json', 'services.json', 'baseline-services.json', 'fixture-services.json', 'functions-unit.json',
    'wire-unit.xml', 'state-unit.xml', 'unit-sources.json']) assert(Object.hasOwn(hashes, file), file);
  for (const [file, expected] of Object.entries(hashes)) {
    assert(!/[\\/]/.test(file)); assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), expected, file);
  }
  for (const workflow of ['backend-ci.yml', 'web-integration-smoke.yml', 'native-ci.yml'])
    assert(text('.github/workflows/' + workflow).includes('tests/emergency-contact-identity.test.mjs'));
  for (const workflow of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const source = text('.github/workflows/' + workflow);
    assert(source.includes('npm run test:emergency-contact-identity')); assert(source.includes('npm run test:emergency-contact-fixture'));
  }
});
test('the private progress update stays local and does not retime old screenshots or claim a new phone run', () => {
  const flow = content.flows.find((item) => item.id === 'emergency-contact');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-19');
  assert.equal(flow.local.source, base + 'services.json'); assert.equal(flow.ui.checkedAt, '2026-10-18');
  assert.equal(flow.phone, undefined); assert.equal(flow.source, base + 'README.md');
  assert(flow.images.every((image) => image.alt.includes('18 octobre')));
  assert.match(flow.remaining, /sur téléphone, sans appeler/); assert.match(flow.remaining, /l’accès de l’enfant/);
});
