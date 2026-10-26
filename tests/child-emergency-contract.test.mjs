import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { parseDocument } from 'yaml';
import { validateChildEmergencyServices, validateRetainedChildEmergency, validateChildContactComponents,
  validateRetainedChildContactComponents, correctedChildContactScope } from '../scripts/qa/child-emergency-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const base = 'docs/release/evidence/child-emergency-services-2026-10-19/';
test('sixteen actual service groups retain explicit preseeded-link and disposal boundaries', () => {
  validateRetainedChildEmergency(root);
});
test('child service evidence cannot accept an approval, device, dialer or production claim', () => {
  const original = JSON.parse(read(base + 'linked/results.json'));
  for (const key of ['physicalDevice', 'nativeUiExecuted', 'dialerOpened', 'productionWrites', 'childAccountApprovalFlowExecuted'])
    assert.throws(() => validateChildEmergencyServices({ ...original, [key]: true }));
  for (const key of ['adminClientClosed', 'emulatorCliExitedSuccessfully', 'isolatedEnvironmentDestroyed', 'childAccountLinkPreseeded'])
    assert.throws(() => validateChildEmergencyServices({ ...original, [key]: false }));
  assert.throws(() => validateChildEmergencyServices({ ...original, steps: original.steps.slice(1) }));
  assert.throws(() => validateChildEmergencyServices({ ...original, providerRequests: 1 }));
});
test('the account identity and child profile are distinct and no client can create their private link', () => {
  const source = read('functions/src/services/childRideEmergencyContact.ts');
  for (const fragment of ['requireRole(token, "child")', 'collection("childAccountLinks").doc(uid)',
    'link.data.accountUserId !== uid', 'link.data.verifiedByUserId === uid', 'const childId = link.data.childId',
    'link.data.childInstanceId !== childInstanceId', 'isActiveGuardianClubMember', 'isGuardianOfChild',
    'verified.data.lastActorUserId === parentId', 'club.createTime', 'child.createTime']) assert(source.includes(fragment));
  assert.match(read('firestore.rules'), /match \/childAccountLinks\/\{accountUserId\}\s*\{\s*allow read, write: if false;/);
  assert(read('scripts/qa/local-child-emergency-suite.mjs').includes('assert.notEqual(view.subjectId, actors.child.uid)'));
});
test('eleven retained JVM cases passed without claiming native component execution', () => {
  for (const [file, count] of [['ui.ChildRideEmergencyStateTest', 8], ['services.ChildRideEmergencyWireTest', 3]]) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'unit/' + file + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['skipped', 'failures', 'errors']) assert.equal(Number(suite['@_' + key]), 0);
    assert.equal(suite.testcase.length, count);
  }
});
test('the child screen has no editor and rechecks authority before a lifecycle-fenced dial-only callback', () => {
  const state = read('android/app/src/main/java/be/sportgreenmoove/app/ui/ChildRideEmergencyState.kt');
  const freshRead = state.indexOf('gateway.readChildRideEmergencyContact(uid, expected.rideSessionId); accept');
  assert(freshRead >= 0 && freshRead < state.indexOf('when (launch('));
  for (const fragment of ['value.ownerUid == uid', 'value.rideSessionId == rideId', 'latest.childId != expected.childId',
    'latest.childInstanceId != expected.childInstanceId', 'generation++; clear(); busy = false']) assert(state.includes(fragment));
  const route = read('android/app/src/main/java/be/sportgreenmoove/app/ui/ChildRideEmergencyRoute.kt');
  assert(!route.includes('saveEmergencyContact')); assert(route.includes('openEmergencyDialer(context, contact)'));
  assert(route.includes('repeatOnLifecycle')); assert(route.includes('state.leaveForeground()'));
  const components = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ChildRideEmergencyFlowTest.kt');
  assert.equal((components.match(/@Test fun/g) ?? []).length, 5);
  for (const fragment of ['width(320.dp)', 'fontScale = 1.3f', 'setOrientationLeft()', 'setOrientationNatural()',
    'EmergencyDialerResult.Unavailable', 'assertEquals(0, fixture.opens)']) assert(components.includes(fragment));
});
test('the actual child service suite and contracts run in backend and web smoke', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJSON();
    assert(Object.values(workflow.jobs).some((job) => job.steps?.some((step) =>
      step.run?.includes('npm run test:child-emergency') && step.run.includes('tests/child-emergency-contract.test.mjs') &&
      step.env?.SGM_LOCAL_FLOW_OUTPUT?.endsWith('/child-emergency-services.json'))));
  }
});
test('five actually executed components retain mocked boundaries and their observed narrow-heading defect', () => {
  const path = 'docs/release/evidence/child-contact-components-2026-10-19/';
  const report = JSON.parse(read(path + 'results.json'));
  assert.equal(report.scope, 'executed-local-child-contact-components-not-child-signin-or-dialer');
  assert.equal(report.componentCaseCount, 5);
  for (const key of ['mockedGateway', 'mockedDialer']) assert.equal(report[key], true);
  for (const key of ['actualChildSignIn', 'connectedBackend', 'dialerOpened', 'physicalDevice', 'productionWrites',
    'fullNativeCiVerified', 'visualCompletenessVerified']) assert.equal(report[key], false);
  assert(report.knownVisualDefects.includes('child-emergency-readonly-narrow-window.png'));
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(path + 'ordinary-tests.xml')).testsuite;
  const cases = suite.testcase.filter((entry) => entry['@_classname'] === 'be.sportgreenmoove.app.ui.ChildRideEmergencyFlowTest');
  assert.equal(cases.length, 5); assert.deepEqual(cases.map((entry) => entry['@_name']).sort(), report.caseNames);
  for (const entry of cases) for (const key of ['error', 'failure', 'skipped']) assert(!Object.hasOwn(entry, key));
  assertRetainedSourceFiles(root, report.sourceFiles);
  for (const [file, hash] of Object.entries(JSON.parse(read(path + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path + file, import.meta.url))).digest('hex'), hash);
  const restored = JSON.parse(read(path + 'disposable-store-restore.json'));
  assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.installAdmin[key], true);
});
test('full emergency headings wrap without shrinking and both narrow cases inspect real text layout overflow', () => {
  const components = read('android/app/src/main/java/be/sportgreenmoove/app/ui/V2Components.kt');
  assert(components.includes('titleLines: Int = 1')); assert(components.includes('maxLines = titleLines'));
  assert(components.includes('fontSize = 22.sp, letterSpacing = 0.sp'));
  for (const file of ['ChildRideEmergencyRoute.kt', 'EmergencyContactScreen.kt'])
    assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/' + file).includes('titleLines = 2'));
  for (const file of ['ChildRideEmergencyFlowTest.kt', 'EmergencyContactFlowTest.kt']) {
    const source = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file);
    assert(source.includes('SemanticsActions.GetTextLayoutResult')); assert(source.includes('titles.single().hasVisualOverflow'));
  }
});
test('the partner gallery separates simulated child screens and uses the newly verified narrow heading', () => {
  const flow = content.flows.find((item) => item.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone, undefined);
  assert.match(flow.summary, /sur téléphone/); assert.match(flow.remaining, /accord du parent/);
  assert.match(flow.remaining, /ouverture réelle du téléphone/); assert.equal(flow.images.length, 6);
  assert.equal(flow.images[0].file, 'child-approved-phone');
  const simulatedImages = flow.images.filter(item => item.file.startsWith('child-contact-'));
  assert.deepEqual(simulatedImages.map((item) => item.file), ['child-contact-narrow', 'child-contact-denied', 'child-contact-changed']);
  const report = JSON.parse(read(flow.ui.source));
  validateRetainedChildContactComponents(root, flow.ui.source);
  assert.equal(report.scope, correctedChildContactScope); assert.equal(report.headingLayoutVerified, true);
  assert.equal(report.mainNativeJobPassed, false); assert.equal(report.parentComponentCaseCount, 7);
  assert.equal(report.remainingMainFailure, 'network-test-preparation');
  for (const extension of ['xml', 'txt']) assert(read('.gitattributes').includes(
    'docs/release/evidence/child-contact-heading-pass-2026-10-19/*.' + extension + ' -text -whitespace'));
  assert(!content.blockers.some((item) => item.id === 'child-contact-heading'));
  for (const image of simulatedImages) {
    assert.match(image.alt, /simulé.*19 octobre/);
    const file = captures[image.file].split('/').at(-1);
    assert(!report.knownVisualDefects.includes(file)); assert(report.screenshots[file]);
  }
  for (const key of ['actualChildSignIn', 'connectedBackend', 'dialerOpened', 'physicalDevice', 'fullNativeCiVerified', 'visualCompletenessVerified'])
    assert.throws(() => validateChildContactComponents({ ...report, [key]: true }));
  for (const patch of [{ headingLayoutVerified: false }, { mainNativeJobPassed: true }, { parentComponentCaseCount: 6 },
    { knownVisualDefects: ['child-emergency-readonly-narrow.png'] }, { reviewedWindows: [] }])
    assert.throws(() => validateChildContactComponents({ ...report, ...patch }));
});
