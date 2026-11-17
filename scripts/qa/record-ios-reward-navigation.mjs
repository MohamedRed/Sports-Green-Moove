import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {iosAutomatedEvidenceIds, validateIosFixtureGate} from './ios-fixture-release-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = 'docs/release/evidence/ios-reward-navigation-2026-11-06';
const output = resolve(root, folder), [beforeLog, afterLog, nativeLog] = process.argv.slice(2);
for (const path of [beforeLog, afterLog, nativeLog]) assert(isAbsolute(path ?? ''));
const read = path => readFileSync(resolve(root, path)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const logs = [beforeLog, afterLog, nativeLog].map(path => readFileSync(path));
assert(logs[0].includes('# fail 1')); assert(logs[1].includes('# fail 0'));
assert(logs[2].includes('Reward navigation checks passed: two granted routes, four denials, invalid mixed roles and seven stale boundaries'));
assert(logs[2].includes('SportsGreenMooveNativeChecks passed'));
const beforeBytes = read('docs/release/evidence-manifest.json'), before = JSON.parse(beforeBytes), after = structuredClone(before);
for (const row of after.automatedUserFlowEvidence.items.filter(row => iosAutomatedEvidenceIds.includes(row.id))) {
  assert.equal(row.status, 'passed');
  assert.equal(row.appSourceCommit, 'd3c0f7afd850dc9b7532386d67eca184f72656e6');
  validateIosFixtureGate(root, row.fixtureGateProof, {matchCurrentSources: false});
  assert.throws(() => validateIosFixtureGate(root, row.fixtureGateProof), /Untested iPhone input/);
  row.status = 'pending';
  row.description = 'Historical d3 SDK and eleven-screen success retained. The new account-owned rewards-to-payments navigation needs its SDK build and complete eleven-screen gate; local logic checks do not accept native rendering, onboarding, transfers or release.';
}
const beforeScreen = execFileSync('git', ['show', '80c6b44eaaff01fc4e0cf5789193c2a11328fbc2:ios/Sources/SportsGreenMooveApp/ImpactRewardsScreens.swift'], {cwd: root});
assert(beforeScreen.includes('rewardsWithdrawAction) {}'));
const checkedAt = new Date().toISOString(), indexName = `automated-user-flow-evidence-${checkedAt.replace(/[:.]/g, '')}-ios-rewards-inputs.json`;
const evidence = resolve(root, 'docs/release/evidence');
const previous = readdirSync(evidence).filter(name => /^automated-user-flow-evidence-.*\.json$/.test(name)).sort().at(-1);
assert(previous && indexName > previous);
const priorBytes = read('docs/release/evidence/' + previous), index = JSON.parse(priorBytes);
index.items = index.items.map(row => iosAutomatedEvidenceIds.includes(row.id) ? after.automatedUserFlowEvidence.items.find(item => item.id === row.id) : row);
index.inheritedEvidence = {source: 'docs/release/evidence/' + previous, sha256: sha(priorBytes)};
index.updatedAt = checkedAt; index.iosInputChange = {source: folder + '/summary.json', reason: 'account-owned-rewards-payment-navigation'};
assert(!existsSync(output)); mkdirSync(output);
const records = [];
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(json(value));
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(output, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('wiring-before.log', logs[0]); record('wiring-after.log', logs[1]); record('native-checks.log', logs[2]);
record('manifest-before.json', beforeBytes); record('manifest-after.json', after); record('index-after.json', index);
const paths = ['ios/Sources/SportsGreenMooveApp/AppState+Rewards.swift', 'ios/Sources/SportsGreenMooveApp/ImpactRewardsScreens.swift',
  'ios/Sources/SportsGreenMooveApp/AppShell.swift', 'ios/Sources/SportsGreenMooveApp/UITestAppStateFactory.swift',
  'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift',
  'ios/Tests/SportsGreenMooveNativeChecks/RewardNavigationChecks.swift', 'scripts/check-ios-native-plan.sh'];
const sources = [{path: 'ios/Sources/SportsGreenMooveApp/ImpactRewardsScreens.swift', commit: '80c6b44eaaff01fc4e0cf5789193c2a11328fbc2', sha256: sha(beforeScreen)}];
for (const path of paths) {
  const bytes = read(path), hash = sha(bytes), archive = resolve(evidence, 'source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); sources.push({path, commit: 'candidate', sha256: hash});
}
record('source-sha256.json', {files: sources});
record('summary.json', {checkedAt: checkedAt.slice(0, 10), recordedAt: checkedAt,
  originalEmptyActionReproduced: true, wiringBeforeExitCode: 1, wiringAfterExitCode: 0, nativePlanExitCode: 0,
  grantedRoutes: 2, deniedRoutes: 4, invalidMixedRolesDenied: true, staleBoundaries: 7,
  originalFixtureCases: 11, extraFixtureCases: 0, existingCaseExtensions: 1, deadlineMinutes: 50,
  onlyIosAcceptanceReopened: true, previousEvidencePreserved: true,
  nativeScreenExecuted: false, sdkLinkedBuildAccepted: false, providerCalled: false,
  onboardingCompleted: false, transferInitiated: false, physicalDeviceAccepted: false, releaseComplete: false, records: [...records]});
assert.deepEqual(read('docs/release/evidence-manifest.json'), beforeBytes);
writeFileSync(resolve(evidence, indexName), json(index), {flag: 'wx'});
writeFileSync(resolve(root, 'docs/release/evidence-manifest.json'), json(after));
console.log(JSON.stringify({source: folder + '/summary.json', sha256: sha(read(folder + '/summary.json')), index: indexName}));
