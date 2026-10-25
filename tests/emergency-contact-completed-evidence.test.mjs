import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';
import { captures } from '../partner-portal/evidence-captures.mjs';
import { validateEmergencyDevice } from '../scripts/qa/emergency-contact-evidence.mjs';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const base = 'docs/release/evidence/local-contact-dialer-pass-2026-10-18/';
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
test('a real scoped contact pass retains its original primary transfer, transcript and seven reviewed captures', () => {
  const report = json(base + 'emergency-contact-results.json');
  assert.equal(report.runId, '5f1452c8c6aafd9c6e08cddea84e43bf'); assert.equal(report.testedAt, '2026-10-18T19:47:31.213Z');
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.equal(report.steps[0].status, 'passed'); assert.equal(report.checks.length, 9);
  assert(report.checks.every((item) => item.status === 'passed'));
  validateEmergencyDevice(json(base + 'emergency-contact-device.json'), json(base + 'adb-pull-emergency-contact.json'), report.runId, (file) => read(base + file));
  assert.equal(sha(read(base + 'LocalEmergencyContactFlowTest-instrumentation.txt')), report.transcriptSha256);
  assert.match(text(base + 'LocalEmergencyContactFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  assert.equal(report.dialerOpened, true); assert.equal(report.directCallIntentCount, 0);
  assert.equal(report.verificationPreseeded, true); assert.equal(report.managerDecisionMethod, 'authenticated-local-sdk-revoke-only');
  assert.equal(report.privateOperationsVerified, 3); assert.equal(report.protectedRecordsUnchanged, true);
  assert.equal(report.isolatedFixtureCleanupVerified, true);
  for (const flag of ['physicalDevice', 'productionWrites', 'childOwnAccountDialImplemented']) assert.equal(report[flag], false);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  assert.equal(Object.keys(report.sourceFiles).length, 19);
  const hashes = json(base + 'artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 17);
  for (const [file, hash] of Object.entries(hashes)) {
    const raw = read(base + file); assert.equal(sha(raw), hash, file);
    if (!file.endsWith('.png')) assert.doesNotMatch(raw.toString('utf8'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  assert.equal(Object.keys(report.screenshots).length, 7);
});
test('executed synchronization regressions and successful restoration do not conceal the later failed full-run copy', () => {
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(base + 'ordinary-tests.xml')).testsuite;
  for (const [key, value] of Object.entries({ tests: 139, skipped: 33, failures: 0, errors: 0 })) assert.equal(Number(suite['@_' + key]), value);
  const cases = suite.testcase.filter((item) => item['@_classname'].endsWith('.ExternalUiSynchronizationTest'));
  assert.equal(cases.length, 3); assert(cases.every((item) => !Object.hasOwn(item, 'skipped') && !Object.hasOwn(item, 'failure')));
  const diagnostic = json(base + 'emergency-dialer-attempt.json');
  assert.equal(diagnostic.observedPackage, 'com.google.android.dialer'); assert.equal(diagnostic.expectedPackageAppeared, true);
  assert.equal(diagnostic.directCallIntentCount, 0);
  const failed = json(base + 'adb-pull-trip-change-schedule.json');
  assert.equal(failed.phase, 'trip-change-schedule'); assert.equal(failed.status, 1); assert.equal(failed.completed, false);
  assert.equal(json(base + 'native-suite-status.json').localReplay, 1);
  const restore = json(base + 'disposable-store-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.mapsRuntime.playServicesEnabled, true); assert.equal(restore.observed.locationEnabled, true);
  const flow = content.flows.find((item) => item.id === 'emergency-contact');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, 'docs/release/evidence/local-contact-identity-pass-2026-10-19/emergency-contact-results.json');
  assert.match(flow.remaining, /enfant/); assert.match(flow.remaining, /trajet/);
  assert.equal(flow.images.filter((item) => item.file.startsWith('emergency-current-')).length, 7);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'blocked');
});
test('the corrected protocol executes nine contact checks with independent parent verification and primary evidence', () => {
  const path = 'docs/release/evidence/local-contact-identity-pass-2026-10-19/';
  const report = json(path + 'emergency-contact-results.json'), sources = json(path + 'source-bindings.json');
  assert.equal(report.runId, '8c355152996e0efebf03d9b084ea39b4'); assert.equal(report.testedAt.slice(0, 10), '2026-10-19');
  validateEmergencyDevice(json(path + 'emergency-contact-device.json'), json(path + 'adb-pull-emergency-contact.json'), report.runId, (file) => read(path + file));
  assert.equal(report.verificationPreseeded, false); assert.equal(report.managerDecisionMethod, 'authenticated-local-sdk-request-verify-revoke');
  for (const key of ['protectedRecordsUnchanged', 'isolatedFixtureCleanupVerified', 'dialerOpened']) assert.equal(report[key], true);
  assert.equal(report.privateOperationsVerified, 3); assert.equal(report.checks.length, 9);
  assert(report.checks.every((item) => item.status === 'passed')); assert.equal(report.directCallIntentCount, 0);
  assert.equal(sha(read(path + 'LocalEmergencyContactFlowTest-instrumentation.txt')), report.transcriptSha256);
  assert.match(text(path + 'LocalEmergencyContactFlowTest-instrumentation.txt'), /OK \(1 test\)/);
  assert.equal(sources.sourceCommit, '685c5080f5391ba7ada966ba81e3a012183f03f6'); assert.equal(sources.sourceCiNativePassed, true);
  for (const key of ['childProfileRecreationUiExecuted', 'activeRideEntryExecuted', 'physicalDevice', 'storeReviewAccepted', 'productionWrites']) assert.equal(sources[key], false);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), sources.sourceFiles);
  const restored = json(path + 'disposable-store-restore.json'); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.installAdmin.authorizationRemoved, true); assert.equal(restored.installAdmin.componentRemoved, true);
  assert.deepEqual(json(path + 'native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  for (const [file, hash] of Object.entries(json(path + 'artifact-sha256.json'))) {
    const raw = read(path + file); assert.equal(sha(raw), hash, file);
    if (!file.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const files = { saved: 'emergency-self-saved.png', restored: 'emergency-self-restored.png', child: 'emergency-child-saved.png',
    revoked: 'emergency-child-revoked.png', dialer: 'emergency-dialer-opened.png', removed: 'emergency-self-removed.png', account: 'emergency-other-account.png' };
  for (const [id, file] of Object.entries(files)) {
    assert.equal(captures['emergency-current-' + id], path + file);
    assert.equal(captures['emergency-passed-' + id], base + file);
  }
});
