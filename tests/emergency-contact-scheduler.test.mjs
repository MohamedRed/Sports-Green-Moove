import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const base = 'docs/release/evidence/local-contact-scheduler-2026-10-18/';
test('the scheduling reproduction retains three actual unit passes without inventing native phone evidence', () => {
  const report = json(base + 'build-checks.json');
  assert.equal(report.scope, 'local-android-unit-and-test-apk-build-not-native-execution');
  assert.equal(report.unitCaseCount, 3); assert.equal(report.nativeRegressionCasesCompiled, 3);
  for (const flag of ['nativeUiExecuted', 'dialerOpened', 'physicalDevice', 'productionWrites']) assert.equal(report[flag], false);
  for (const [file, hash] of Object.entries(report.artifacts))
    assert.equal(createHash('sha256').update(read(base + file)).digest('hex'), hash);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(base + 'scheduler-unit-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 3);
  for (const field of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + field]), 0);
  assert.deepEqual(suite.testcase.map((item) => item['@_name']), report.unitCases);
  for (const [file, hash] of Object.entries(report.sourceFiles)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
});
test('the external wait preserves callback progress, original failures and the exact phone readiness boundary', () => {
  const native = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalEmergencyContactFlowTest.kt');
  assert(native.includes('awaitLocalExternalUi(compose, 60_000, { device.hasObject(By.pkg(dialerPackage)) })'));
  for (const guard of ['assertEquals(dialerPackage, device.currentPackageName)', 'assertEquals(1, dial.hits)', 'assertEquals(0, directCall.hits)',
    'assertNull(removed.contact)', 'assertEquals(2L, removed.revision)']) assert(native.includes(guard), guard);
  const wait = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalExternalUiWait.kt');
  assert(wait.includes('compose.waitUntil(timeoutMillis)')); assert(wait.includes('throw failure')); assert(wait.includes('check(appeared)'));
  assert(wait.includes('diagnostic.exceptionOrNull()?.let(failure::addSuppressed)')); assert(wait.includes('diagnostic.getOrThrow()'));
  assert(!wait.includes('Thread.sleep')); assert(!native.includes('device.wait(Until.hasObject'));
  const tests = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ExternalUiSynchronizationTest.kt');
  assert.equal((tests.match(/@Test fun/g) ?? []).length, 3);
  assert(tests.includes('assertFalse("A callback completion alone')); assert(tests.includes('failure is ComposeTimeoutException'));
});
test('a separate system-module restart never becomes contact or restoration success', () => {
  const prefix = base + 'native-interruption/';
  const hashes = json(prefix + 'artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 4);
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(prefix + file)).digest('hex'), hash);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(prefix + 'ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 127); assert.equal(Number(suite['@_failures']), 1); assert.equal(Number(suite['@_skipped']), 33);
  assert.equal(suite.testcase.filter((item) => Object.hasOwn(item, 'failure')).length, 1);
  assert(text(prefix + 'ordinary-tests.xml').includes('Process crashed'));
  assert.equal(read(prefix + 'disposable-store-restore.json').length, 0);
  const excerpt = json(prefix + 'module-restart-excerpt.json');
  assert.equal(excerpt.sourceSha256, '2c3b91380f5e6a0e0cb512f6371bdeed888b0fea71a458cd9438348ab9dd835b');
  assert.equal(excerpt.testProcessId, 5003); assert.equal(excerpt.contactReplayExecuted, false); assert.equal(excerpt.restoreReceiptEmpty, true);
  assert.deepEqual(excerpt.selectedLines.map((line) => line.line), [1, 512, 513]);
  assert(excerpt.selectedLines[1].text.includes('forcing restart')); assert(excerpt.selectedLines[2].text.includes('PID: 5003 SIG: 9'));
  assert.deepEqual(json(prefix + 'native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 1 });
});
test('current private updates retain the prior observations without claiming whole-run or physical success', () => {
  const flow = content.flows.find((item) => item.id === 'emergency-contact'); assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /sans appeler/); assert.equal(flow.images.filter((item) => item.file.startsWith('emergency-passed-')).length, 7);
  assert(content.updates.some((item) => item.title === 'Le contact revient dans l’app'));
  assert.equal(content.blockers.find((item) => item.id === 'test-device-stability').source,
    'docs/release/evidence/team-screen-export-2026-10-18/later-update-interruption/README.md');
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});
test('synchronization proof and regressions are covered by web and native configuration gates', () => {
  const file = 'tests/emergency-contact-scheduler.test.mjs';
  for (const path of ['.github/workflows/web-integration-smoke.yml', '.github/workflows/native-ci.yml']) {
    const source = text(path); assert(source.includes(file)); assert(source.includes('node --test'));
  }
  assert(text('.github/workflows/web-integration-smoke.yml').includes('LocalExternalUiWait.kt'));
});
