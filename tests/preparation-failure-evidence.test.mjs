import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content, captures} from '../partner-portal/content.mjs';
import {assertInvitationConnectionRecheck, invitationConnectionRecheckFolder,
  validateInvitationConnectionRecheck} from '../scripts/qa/invitation-connection-recheck-evidence.mjs';
import {assertInvitationConnectionFailure, invitationConnectionFolder, validateInvitationConnectionFailure,
  validateNativeCapacityFailure} from '../scripts/qa/preparation-failure-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
test('fresh phone errors keep host observations separate from routing, account creation and package absence', () => {
  assert.deepEqual(validateInvitationConnectionRecheck(root), {formReached:false,accountsCreated:0,
    parentApprovalProven:false,temporaryPortClosed:true,releaseComplete:false});
  const progress=content.updates.find(row=>row.source===invitationConnectionRecheckFolder+'README.md'); assert(progress);
  assert.equal(progress.flow,'child-emergency');
  assert.equal(content.flows.find(row=>row.id==='child-emergency').status,'partial');
  assert(!Object.values(captures).some(path=>path.startsWith(invitationConnectionRecheckFolder)));
  assert.equal(content.blockers.find(row=>row.id==='child-invitation-browser').connectionHistory,invitationConnectionRecheckFolder+'README.md');
});
for(const key of ['installedApkIndependentlyHashed','browserFormReached','childAccountCreated','parentApprovalProven',
  'nativeShareToSignupProven','helperConnectionContinuityProven','rootCauseConfirmed','browserAliasEnabled',
  'resolveAllUrlsEnabled','requestLoggingEnabled','productionWrites','realPayments','videoRecorded','releaseComplete'])
  test('fresh negative phone proof cannot promote '+key,()=>{
    const review=JSON.parse(readFileSync(resolve(root,invitationConnectionRecheckFolder,'review.json')));
    review[key]=true; assert.throws(()=>assertInvitationConnectionRecheck(review),new RegExp(key));
  });
const reports = () => ['summary', 'observations', 'connection-blocked-records', 'disposal', 'phone-disposal']
  .map(file => JSON.parse(readFileSync(resolve(root, invitationConnectionFolder, file + '.json'))));
test('the two retained phone errors never prove account creation, parent approval, helper continuity or uninstall', () => {
  assert.deepEqual(validateInvitationConnectionFailure(root),
    {formReached: false, signupCompleted: false, accountsCreated: 0, capturesPublished: 0, releaseComplete: false});
});
for (const key of ['browserFormReached', 'childAccountCreated', 'parentApprovalProven', 'nativeShareToSignupProven',
  'productionWrites', 'browserAliasEnabled', 'helperExitTimeKnown', 'helperConnectionContinuityProven',
  'independentPackageAbsenceProven', 'releaseComplete']) test('negative phone proof rejects ' + key, () => {
  const rows = reports(); rows[0][key] = true; assert.throws(() => assertInvitationConnectionFailure(...rows));
});
test('terminal full native failure is specifically a capacity failure before UI, not another accepted capture run', () => {
  assert.deepEqual(validateNativeCapacityFailure(root), {failurePhase: 'emulator-capacity-before-tests', acceptedTestCases: 0, releaseComplete: false});
});
test('public progress keeps earlier successful phone galleries and adds no diagnostic screenshots or readiness promotion', () => {
  const update = content.updates.find(row => row.source === invitationConnectionFolder + 'README.md');
  assert(update); assert.equal(update.flow, 'child-emergency');
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.notEqual(flow.checkedAt, '2026-10-30');
  assert(!Object.values(captures).some(path => path.startsWith(invitationConnectionFolder)));
  assert(content.blockers.some(row => row.id === 'child-invitation-browser'));
  assert(!content.blockers.some(row => row.id === 'native-device-capacity'));
  const capacityUpdate = content.updates.find(row => row.source === 'docs/release/evidence/native-capacity-e64555e-2026-10-30/README.md');
  assert(capacityUpdate);
  for (const row of [update, capacityUpdate]) assert.doesNotMatch(row.title + row.text, /BrowserStack|Firebase|SDK|localhost|port|APK/);
});
