import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { parseDocument } from 'yaml';
import { validateChildEmergencyServices, validateRetainedChildEmergency } from '../scripts/qa/child-emergency-evidence.mjs';

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
  assert(state.indexOf('gateway.readChildRideEmergencyContact(uid, rideId); accept') < state.indexOf('when (launch('));
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
