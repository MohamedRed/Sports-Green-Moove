import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';
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
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, base + 'emergency-contact-results.json');
  assert.match(flow.remaining, /enfant/); assert.match(flow.remaining, /trajet/);
  assert.equal(flow.images.filter((item) => item.file.startsWith('emergency-passed-')).length, 7);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});
