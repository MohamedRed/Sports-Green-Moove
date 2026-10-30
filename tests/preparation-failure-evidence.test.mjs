import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content, captures} from '../partner-portal/content.mjs';
import {assertInvitationConnectionFailure, invitationConnectionFolder, validateInvitationConnectionFailure,
  validateNativeCapacityFailure} from '../scripts/qa/preparation-failure-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
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
  assert.equal(content.updates[0].source, invitationConnectionFolder + 'README.md');
  assert.equal(content.updates[0].flow, 'child-emergency');
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.notEqual(flow.checkedAt, '2026-10-30');
  assert(!Object.values(captures).some(path => path.startsWith(invitationConnectionFolder)));
  assert(content.blockers.some(row => row.id === 'child-invitation-browser'));
  assert(content.blockers.some(row => row.id === 'native-device-capacity'));
  for (const row of content.updates.slice(0, 2)) assert.doesNotMatch(row.title + row.text, /BrowserStack|Firebase|SDK|localhost|port|APK/);
});
