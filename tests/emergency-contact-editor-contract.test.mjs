import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('the contact gateway binds ownership around every SDK operation and requires current child identity', () => {
  const source = read(base + 'services/FirebaseAndroidEmergencyContactGateway.kt');
  assert.equal(source.split('requireSession(uid)').length - 1, 2);
  for (const guard of ['auth.currentUser?.uid != uid', 'guardians.guardianView(uid, target.clubId, target.childId)',
    'it.parentUserId == uid', 'it.childId == target.childId', 'it.clubId == target.clubId',
    'it.status == GuardianVerificationStatus.Verified', 'it.childName != null', 'it.clubName != null']) assert(source.includes(guard));
  assert(source.includes('"getEmergencyContact"')); assert(source.includes('"saveEmergencyContact"'));
  const wire = read(base + 'services/EmergencyContactWire.kt');
  assert(wire.includes('check(it.containsKey("contact"))')); assert(wire.includes('version > operation.expectedRevision'));
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
test('the six component cases and four captures are required but do not imply actual device or service execution', () => {
  const tests = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/EmergencyContactFlowTest.kt');
  assert.equal((tests.match(/@Test fun/g) ?? []).length, 6);
  assert(tests.includes('EmergencyUiFixture')); assert(tests.includes('launchDialer ='));
  assert(tests.includes('waitFor(hasTestTag(tag) and isEnabled())'));
  assert(tests.includes('Box(Modifier.width(320.dp)')); assert(tests.includes('fontScale = 1.3f'));
  const shell = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(shell.includes('adb pull /sdcard/Download/sgm-emergency-contact "$output_dir" || return 1'));
  for (const file of ['emergency-editor-narrow.png', 'emergency-editor-narrow-window.png', 'emergency-editor-changed.png', 'emergency-editor-changed-window.png'])
    assert(shell.includes(file), file);
  assert(read('tests/native-suite-runner.test.mjs').includes('stale contact component files cannot hide a failed fresh copy'));
});
test('new contact code and the app root remain below the modularity limit', () => {
  const paths = ['data/EmergencyContactModels.kt', 'services/EmergencyContactGateway.kt', 'services/EmergencyContactWire.kt',
    'services/FirebaseAndroidEmergencyContactGateway.kt', 'services/AndroidEmergencyDialer.kt', 'ui/EmergencyContactState.kt',
    'ui/EmergencyContactScreen.kt', 'ui/EmergencyContactRoute.kt', 'ui/EmergencyContactDialogs.kt', 'ui/SportsGreenMooveApp.kt'];
  for (const path of paths) assert(read(base + path).split('\n').length < 300, path);
});
test('retained current-source evidence proves 23 unit cases and compilation only', () => {
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
  for (const [path, hash] of Object.entries(report.sourceFiles)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash, path);
});
