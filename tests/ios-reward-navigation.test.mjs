import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {iosAutomatedEvidenceIds, assertCurrentIosAutomatedEvidence} from '../scripts/qa/ios-fixture-release-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('the iPhone rewards command executes an account-owned action rather than an empty closure', () => {
  const screen = read('ios/Sources/SportsGreenMooveApp/ImpactRewardsScreens.swift');
  assert.doesNotMatch(screen, /rewardsWithdrawAction\)\s*\{\s*\}/);
  assert(screen.includes('appState.openRewardPayments(access: access)'));
  assert(read('ios/Sources/SportsGreenMooveApp/AppShell.swift').includes('RewardsScreen(access: access)'));
});

const folder = 'docs/release/evidence/ios-reward-navigation-2026-11-06/';
const json = path => JSON.parse(read(path)), sha = value => createHash('sha256').update(value).digest('hex');
test('actual native checks exercise granted, denied and stale reward navigation without a transfer', () => {
  const report = json(folder + 'summary.json');
  assert.deepEqual([report.grantedRoutes, report.deniedRoutes, report.staleBoundaries], [2, 4, 7]);
  assert.equal(report.invalidMixedRolesDenied, true); assert.equal(report.nativePlanExitCode, 0);
  for (const key of ['nativeScreenExecuted', 'sdkLinkedBuildAccepted', 'providerCalled', 'onboardingCompleted',
    'transferInitiated', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false);
  for (const row of report.records) assert.equal(sha(read(folder + row.file)), row.sha256);
  for (const row of json(folder + 'source-sha256.json').files) {
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
    if (row.commit === 'candidate') assert.equal(sha(read(row.path)), row.sha256);
  }
  assert.match(read(folder + 'native-checks.log'), /Reward navigation checks passed:/);
  assert.match(read(folder + 'wiring-before.log'), /# fail 1/);
  assert.match(read(folder + 'wiring-after.log'), /# fail 0/);
});
test('new source inputs reopen only the two automated entries and retain all old references', () => {
  const before = json(folder + 'manifest-before.json'), after = json(folder + 'manifest-after.json');
  for (const key of Object.keys(before).filter(key => key !== 'automatedUserFlowEvidence')) assert.deepEqual(after[key], before[key]);
  for (const old of before.automatedUserFlowEvidence.items) {
    const row = after.automatedUserFlowEvidence.items.find(item => item.id === old.id);
    if (iosAutomatedEvidenceIds.includes(old.id)) {
      assert.equal(old.status, 'passed'); assert.equal(row.status, 'pending');
      assert.deepEqual({...row, status: old.status, description: old.description}, old);
    } else assert.deepEqual(row, old);
  }
  assertCurrentIosAutomatedEvidence();
});
test('the existing secondary screen test only adds navigation and refusal assertions, not cases or provider calls', () => {
  const path = 'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift';
  const originalRow = json('docs/release/evidence/ios-fixture-gate-d3c0f7a-2026-11-06/source-sha256.json').files.find(row => row.path === path);
  const original = read('docs/release/evidence/source-archive/' + originalRow.sha256 + '.txt'), current = read(path);
  const start = current.indexOf('        tapIdentifier("rewards.withdraw.action", in: app)');
  const end = current.indexOf('\n        app = launch(route: "options")', start);
  assert(start > 0 && end > start);
  assert.equal(current.slice(0, start) + '\n' + current.slice(end + 1), original);
  assert(current.includes('app = launch(route: "rewards-parent")'));
  const action = read('ios/Sources/SportsGreenMooveApp/AppState+Rewards.swift');
  for (const text of ['access.isCurrent', 'accountAccess?.context == access.context', 'overlay == .rewards',
    'access.context.grantedRoles.contains(.driver)', 'selectedRole = .driver', 'openOverlay(.payments)']) assert(action.includes(text));
  assert.doesNotMatch(action, /await|createStripeAccount|prepareRidePayment|transfer|setCustomUserClaims/);
  const workflow = parseDocument(read('.github/workflows/ios-mvp-verification.yml')).toJSON();
  assert.equal(workflow.jobs['ios-fixture-verification']['timeout-minutes'], 50);
  assert.equal(workflow.on.workflow_dispatch.inputs.retain_approved_captures.default, false);
  for (const name of ['AppState+Rewards.swift', 'RewardNavigationChecks.swift']) assert(read('scripts/check-ios-native-plan.sh').includes(name));
});
test('the portal distinguishes local navigation proof from an actual app or transfer result', () => {
  const note = content.updates.find(row => row.source === folder + 'README.md'); assert(note);
  assert.match(note.text, /contrôles locaux/); assert.match(note.text, /reste à faire/);
  assert.doesNotMatch(note.text + note.title, /Firebase|BrowserStack|SDK|Swift|CI\b/);
  assert(content.updates.some(row => row.source.includes('ios-fixture-gate-d3c0f7a')));
  assert.equal(content.flows.length, 34);
});
