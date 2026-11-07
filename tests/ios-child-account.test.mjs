import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {iosChildAccount, iosChildAccountProgress} from '../partner-portal/ios-child-account.mjs';
import {iosAutomatedEvidenceIds, assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import './ios-child-binding.mjs';
import './ios-child-presentation.mjs';
import './ios-presentation-modules.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
const app = 'ios/Sources/SportsGreenMooveApp/', folder = 'docs/release/evidence/ios-child-account-2026-11-06/';
test('child account operations use the existing owned callable boundary and immutable server-selected target', () => {
  const source = read(app + 'FirebaseChildAccountGateway.swift');
  for (const method of ['createChildAccountLinkCode', 'approveChildAccountLink', 'getChildInvitation', 'createChildInvitation', 'revokeChildInvitation'])
    assert(source.includes('name: "' + method + '"'));
  assert.equal((source.match(/firebaseOwnedCall\(/g) ?? []).length, 5);
  assert.doesNotMatch(source, /collection\(|setCustomUserClaims|UserDefaults|print\(|NSLog|async throws -> Any/);
  const models = read(app + 'ChildAccountModels.swift'), wire = read(app + 'ChildAccountWire.swift');
  assert(models.includes('try EmergencyContactWire.validate(view, uid: view.ownerUid, scope: view.scope)'));
  for (const text of ['"childId": value.childId', '"clubId": value.clubId', '"expectedChildInstanceId": value.childInstanceId',
    'CFGetTypeID(flag) == CFBooleanGetTypeID()', 'account != uid', 'row.keys.contains("current")']) assert(wire.includes(text));
  const configuration = json('functions/src/config/childInvitation.json');
  assert.equal(configuration.signupUrl, 'https://sports-green-moove-prod.web.app/child-invitation');
});
test('private links are validated without persistence, secret reconstruction, automatic signup or approval', () => {
  const wire = read(app + 'ChildInvitationWire.swift'), state = read(app + 'ChildInvitationState.swift');
  for (const text of ['components.percentEncodedFragment', 'components.percentEncodedQuery == nil', 'components.port == nil',
    'components.user == nil', 'components.password == nil', 'SHA256.hash(data: Data(token.utf8))', 'link.current.expiresAtMillis > now']) assert(wire.includes(text));
  for (const text of ['private var link:', 'link = nil', 'link.current == current', 'access.begin()', 'access.finish(work); busy = false',
    'generation == ticket', 'access.owns(work)', 'current?.status != .provisioning', 'current?.status != .accepted']) assert(state.includes(text));
  assert.doesNotMatch(state + wire + read(app + 'ChildAccountState.swift'), /UserDefaults|write\(to:|print\(|NSLog|setCustomUserClaims|redeemChildInvitation|roleLabel/);
  const screen = read(app + 'ChildInvitationSection.swift');
  assert(screen.includes('if let url = state.sharingURL()')); assert(screen.includes('UIActivityViewController(activityItems: [url]'));
  assert(screen.includes('state.suspend(); shared = nil'));
  assert(read(app + 'EmergencyContactScreen.swift').includes('child-account.entry.child'));
  assert(read(app + 'GuardianContactPicker.swift').includes('try ChildAccountPresentation(access: access, view: view)'));
  assert(modelsContainAtomicTarget());
});

function modelsContainAtomicTarget() {
  const model = read(app + 'ChildAccountPresentation.swift'), host = read(app + 'GuardianContactPicker.swift');
  return model.includes('self = .parent(UUID(), try ChildAccountTarget(view: view))') &&
    host.includes('.sheet(item: $accountPresentation) { presentation in') &&
    host.includes('target: presentation.target') && !host.includes('managingAccount') && !host.includes('childTarget');
}
test('both original screen cases are strictly additive and keep the eleven-case inventory and deadline', () => {
  const sources = json('docs/release/evidence/ios-fixture-gate-6fb6487-2026-11-06/source-sha256.json').files;
  for (const [name, call] of [['EmergencyContactFlowTests.swift', 'checkChildCodeInExistingContactCase(app)'],
    ['ParentEmergencyContactFlowTests.swift', 'checkParentInvitationInExistingContactCase(app)']]) {
    const path = 'ios/UITests/SportsGreenMooveUITests/' + name, row = sources.find(row => row.path === path);
    const original = read('docs/release/evidence/source-archive/' + row.sha256 + '.txt'), current = read(path);
    assert.equal(current.split(call).length, 2);
    assert.equal(current.replace('        ' + call + '\n', ''), original);
  }
  const paths = 'ios/UITests/SportsGreenMooveUITests/';
  const files = readdirSync(new URL('../' + paths, import.meta.url)).filter(file => file.endsWith('.swift'));
  assert.equal(files.flatMap(file => [...read(paths + file).matchAll(/func (test\w+)\(/g)]).length, 11);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert.equal(workflow.on.workflow_dispatch.inputs.retain_approved_captures.default, false);
  assert.doesNotMatch(read(paths + 'ChildAccountFlowChecks.swift'), /XCTSkip|screenshot\(|sleep\(|captureApproved/);
});
test('retained actual checks reopen only iPhone acceptance and never accept a new SDK or connected journey', () => {
  const report = json(iosChildAccount.source); assert.equal(sha(read(iosChildAccount.source)), iosChildAccount.sha256);
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256, row.file);
  assert.equal(report.malformedResponsesRejected, 34); assert.equal(report.delayedBoundaries, 70);
  assert.equal(report.nativePlanExitCode, 0); assert.equal(report.signaturesExitCode, 0);
  for (const key of ['sdkLinkedBuildAccepted', 'fixtureUiExecuted', 'systemShareExecuted', 'connectedChildSignupAccepted', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  const before = json(folder + 'manifest-before.json'), after = json(folder + 'manifest-after.json');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const row of before.automatedUserFlowEvidence.items) {
    const next = after.automatedUserFlowEvidence.items.find(item => item.id === row.id);
    if (iosAutomatedEvidenceIds.includes(row.id)) {
      assert.equal(next.status, 'pending'); assert.deepEqual({...next, status: row.status, description: row.description}, row);
    } else assert.deepEqual(next, row);
  }
  assertCurrentIosAutomatedEvidence();
  assert.deepEqual(content.iosChildAccount, iosChildAccount); assert(content.updates.some(row => row.source === iosChildAccountProgress.source));
  assert.doesNotMatch(iosChildAccountProgress.title + iosChildAccountProgress.text, /Firebase|BrowserStack|SDK|Swift|CI\b/);
});
test('the existing Mac checks compile and run child guards while web jobs check their contracts', () => {
  for (const text of ['ChildAccountWireChecks.swift', 'ChildAccountStateChecks.swift', 'ChildAccountBoundaryChecks.swift', 'UITestChildAccounts.swift'])
    assert(read('scripts/check-ios-native-plan.sh').includes(text));
  assert(read('scripts/check-ios-support-concurrency.sh').includes('FirebaseChildAccountGateway.swift'));
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/ios-child-account.test.mjs'));
  assert(workflow.jobs.smoke.steps.some(step => step.run?.includes('tests/ios-child-account.test.mjs')));
});
