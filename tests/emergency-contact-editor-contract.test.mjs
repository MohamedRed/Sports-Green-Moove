import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('the contact gateway binds ownership around every SDK operation and requires current child identity', () => {
  const source = read(base + 'services/FirebaseAndroidEmergencyContactGateway.kt');
  assert.equal(source.split('requireSession(uid)').length - 1, 2);
  assert(source.includes('auth.currentUser?.uid != uid'));
  assert(!source.includes('guardians.guardianView('), 'Child labels and immutable identity must come from the same contact transaction');
  assert(source.includes('"getEmergencyContact"')); assert(source.includes('"saveEmergencyContact"'));
  const wire = read(base + 'services/EmergencyContactWire.kt');
  assert(wire.includes('check(it.containsKey("contact"))')); assert(wire.includes('version > operation.expectedRevision'));
  for (const guard of ['value["clubId"] == target.clubId', 'instance(value["childInstanceId"])',
    'label(it["childName"])', 'label(it["clubName"])', 'instance(operation.expectedChildInstanceId)']) assert(wire.includes(guard), guard);
});
test('the only phone action is a validated dialer intent without direct-call permission or substituted destinations', () => {
  const dialer = read(base + 'services/AndroidEmergencyDialer.kt');
  assert(dialer.includes('Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", contact.phone, null))'));
  assert(dialer.includes('ActivityNotFoundException')); assert(dialer.includes('EmergencyDialerResult.Unavailable'));
  assert.doesNotMatch(dialer, /ACTION_CALL\b|placeCall|\+32|112|911|logger|Log\./);
  assert(!read('android/app/src/main/AndroidManifest.xml').includes('android.permission.CALL_PHONE'));
  const state = read(base + 'ui/EmergencyContactState.kt');
  assert(state.includes('latest.revision != expected.revision || latest.contact != expected.contact'));
  assert(state.indexOf('latest.revision != expected.revision') < state.indexOf('val launched = launch'));
  assert(state.includes('if (!current(ticket)) return')); assert(state.includes('expected !== view'));
  assert(state.includes('fun leaveForeground() { generation++; clearPrivate(); busy = false }'));
});
test('settings and active rides open the same private editor and preserve the return destination', () => {
  const root = read(base + 'ui/SportsGreenMooveApp.kt');
  assert(root.includes('contactReturn = AppScreen.Ride; screen = AppScreen.EmergencyContacts'));
  assert(root.includes('contactReturn = AppScreen.Options; screen = AppScreen.EmergencyContacts'));
  assert(root.includes('providers.emergencyContacts, providers.firebase, { screen = contactReturn }'));
  const settings = read(base + 'ui/OptionsScreen.kt'), ride = read(base + 'ui/RideMonitorScreen.kt');
  assert(!settings.includes('+32 470 00 00 00')); assert(settings.includes('"options.emergency"'));
  assert(ride.includes('RideEmergencyAction(onEmergencyContact)')); assert(!ride.includes('Action directe disponible'));
  const route = read(base + 'ui/EmergencyContactRoute.kt');
  assert(route.includes('rememberSaveable(uid)')); assert(route.includes('finally { state.leaveForeground() }'));
  assert(route.includes('Lifecycle.State.STARTED')); assert(route.includes('state.close(); children.close()'));
});
test('the seven prepared component cases and four captures do not imply actual device or service execution', () => {
  const tests = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/EmergencyContactFlowTest.kt');
  assert.equal((tests.match(/@Test fun/g) ?? []).length, 7);
  assert(tests.includes('EmergencyUiFixture')); assert(tests.includes('launchDialer ='));
  assert(tests.includes('waitFor(hasTestTag(tag) and isEnabled())'));
  assert(tests.includes('Box(Modifier.width(320.dp)')); assert(tests.includes('fontScale = 1.3f'));
  const shell = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(shell.includes('adb pull /sdcard/Download/sgm-emergency-contact "$output_dir" || return 1'));
  for (const file of ['emergency-editor-narrow.png', 'emergency-editor-narrow-window.png', 'emergency-editor-changed.png', 'emergency-editor-changed-window.png'])
    assert(shell.includes(file), file);
  assert(read('tests/native-suite-runner.test.mjs').includes('stale contact component files cannot hide a failed fresh copy'));
});
test('child selection is accepted before persistence and a busy picker cannot silently discard the choice', () => {
  const state = read(base + 'ui/EmergencyContactState.kt');
  assert(state.includes('fun select(next: EmergencyContactTarget): Boolean'));
  assert(state.includes('if (closed || busy) return false'));
  const route = read(base + 'ui/EmergencyContactRoute.kt');
  const selection = route.slice(route.indexOf('fun select(target:'), route.indexOf('DisposableEffect(state, children)'));
  assert(selection.indexOf('if (state.select(target))') < selection.indexOf('savedScope ='));
  assert(selection.indexOf('savedScope =') < selection.indexOf('picker = false'));
  assert(selection.includes('scope.launch { state.refresh() }'));
  assert(route.includes('selectionBusy = state.busy'));
  assert(read(base + 'ui/EmergencyContactDialogs.kt').includes('enabled = !page.busy && !selectionBusy'));
  const component = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/EmergencyContactFlowTest.kt');
  for (const text of ['historyGate = CompletableDeferred()', 'firstReadGate = CompletableDeferred()',
    'compose.onNodeWithTag(child).assertIsNotEnabled()', 'fixture.firstReadGate!!.complete(Unit)',
    'hasTestTag("emergency.subject") and hasText("Enfant fictif QA")']) assert(component.includes(text));
});
test('the original child selection timeout stays negative with independent policy restoration', () => {
  const path = 'docs/release/evidence/emergency-selection-race-2026-10-19/';
  const failed = read(path + 'failed/LocalEmergencyIdentityFlowTest-instrumentation.txt');
  assert(failed.includes('LocalEmergencyIdentityFlowTest.kt:60'));
  assert(failed.includes('Condition still not satisfied after 60000 ms'));
  assert(failed.includes('Tests run: 1,  Failures: 1')); assert(!failed.includes('OK (1 test)'));
  assert.equal(JSON.parse(read(path + 'failed/emergency-identity-suite-status.json')).status, 1);
  const restored = JSON.parse(read(path + 'failed/disposable-store-restore.json'));
  for (const key of ['restored', 'verified']) assert.equal(restored[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.installAdmin[key], true);
  assertRetainedSourceFiles(fileURLToPath(new URL('..', import.meta.url)), JSON.parse(read(path + 'failed/source-files.json')));
  for (const [file, hash] of Object.entries(JSON.parse(read(path + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path + file, import.meta.url))).digest('hex'), hash);
});
test('the executed selection regressions and successful compilation cannot imply a corrected native pass', () => {
  const path = 'docs/release/evidence/emergency-selection-race-2026-10-19/regression/';
  const scope = JSON.parse(read(path + 'scope.json'));
  assert.equal(scope.scope, 'local-unit-regressions-and-compilation-not-native-execution');
  assert.equal(scope.unitCaseCount, 23); assert.equal(scope.preparedComponentCaseCount, 7);
  for (const key of ['nativeRegressionExecuted', 'correctedIdentityUiVerified', 'physicalDevice']) assert.equal(scope[key], false);
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const [file, count] of [['EmergencyContactSelectionTest', 3], ['EmergencyContactStateTest', 20]]) {
    const suite = parser.parse(read(path + file + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), count); assert.equal(suite.testcase.length, count);
    for (const key of ['errors', 'failures', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  }
  assert(read(path + 'build-transcript.txt').includes('BUILD SUCCESSFUL'));
  assertRetainedSourceFiles(fileURLToPath(new URL('..', import.meta.url)), scope.sourceFiles);
});
test('new contact code and the app root remain below the modularity limit', () => {
  const paths = ['data/EmergencyContactModels.kt', 'services/EmergencyContactGateway.kt', 'services/EmergencyContactWire.kt',
    'services/FirebaseAndroidEmergencyContactGateway.kt', 'services/AndroidEmergencyDialer.kt', 'ui/EmergencyContactState.kt',
    'ui/EmergencyContactScreen.kt', 'ui/EmergencyContactRoute.kt', 'ui/EmergencyContactDialogs.kt', 'ui/SportsGreenMooveApp.kt'];
  for (const path of paths) assert(read(base + path).split('\n').length < 300, path);
});
test('retained editor snapshot proves 23 unit cases and compilation only without claiming newer navigation was tested', () => {
  const evidence = 'docs/release/evidence/local-emergency-editor-2026-10-18/';
  const report = JSON.parse(read(evidence + 'build-checks.json'));
  assert.equal(report.unitCaseCount, 23); assert.equal(report.nativeComponentCasesCompiled, 6);
  assert.equal(report.nativeTestApkCompiled, true);
  for (const field of ['nativeUiExecuted', 'dialerOpened', 'physicalDevice', 'productionWrites', 'serviceImplementationDeployed'])
    assert.equal(report[field], false, field);
  let count = 0;
  for (const [path, hash] of Object.entries(report.artifacts)) {
    const raw = read(evidence + path); assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    const suite = new XMLParser({ ignoreAttributes: false }).parse(raw).testsuite;
    for (const field of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + field]), 0);
    count += Number(suite['@_tests']);
  }
  assert.equal(count, 23);
  const provenance = JSON.parse(read(evidence + 'source-provenance.json'));
  assert.equal(provenance.sourceCommit, '351aa4d571d2de3e0df670b4bff906250523a9e0');
  const historical = provenance.historicalSourceFiles;
  assert.deepEqual(Object.keys(historical).sort(), ['android/app/src/main/java/be/sportgreenmoove/app/ui/AppDestinations.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt']);
  for (const [path, snapshot] of Object.entries(historical))
    assert.equal(createHash('sha256').update(read(evidence + snapshot)).digest('hex'), report.sourceFiles[path], path);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
});
