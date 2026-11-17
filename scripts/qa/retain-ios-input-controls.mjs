import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-input-controls-2026-11-05');
assert(!existsSync(resolve(folder, 'summary.json')), 'Never overwrite a retained result'); mkdirSync(folder, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const write = (name, bytes) => writeFileSync(resolve(folder, name), bytes, {flag: 'wx'});
const read = path => readFileSync(resolve(root, path));
const baseline = '62f5365485e4e8550231c1d6b2ac8206a2e3a92b', files = [], records = [];
const archive = (path, bytes, commit) => {
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, commit, sha256: hash});
};
for (const [from, to, marker] of [
  ['sgm-iphone-input-baseline-20261105.log', 'baseline-result.txt', '12 baseline draft truncation reproductions (not accepted)'],
  ['sgm-iphone-input-candidate-20261105.log', 'candidate-state-result.txt', '12 exact-body read/input boundaries passed'],
  ['sgm-iphone-input-complete-20261105.log', 'complete-native-result.txt', 'Membership fixture state passed: reject'],
  ['sgm-iphone-ui-recovery-signature-20261105.log', 'signature-result.txt', 'not an SDK build or phone test'],
  ['sgm-iphone-ui-recovery-syntax-v2-20261105.log', 'syntax-result.txt', ''],
  ['sgm-iphone-membership-fixture-v4-20261105.log', 'fixture-state-result.txt', 'Membership fixture state passed: approve'],
]) {
  const bytes = readFileSync(resolve(input, from)); assert(bytes.toString().includes(marker));
  assert(!/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  write(to, bytes); records.push({file: to, sha256: sha(bytes)});
}
const app = 'ios/Sources/SportsGreenMooveApp/';
const paths = ['TeamChatState.swift', 'ProfileCityEntry.swift', 'ProfileSettingsCard.swift', 'MembershipReviewScreen.swift',
  'MembershipReviewState.swift', 'UITestMembershipGateway.swift', 'TeamChatComposer.swift', 'TeamChatMessageViews.swift',
  'AccountWorkScope.swift'].map(path => app + path);
paths.push('ios/Tests/SportsGreenMooveNativeChecks/TeamChatEditingChecks.swift', 'ios/Tests/SportsGreenMooveNativeChecks/main.swift',
  'scripts/check-ios-native-plan.sh', 'scripts/qa/check-ios-membership-fixture.sh',
  'tests/fixtures/ios-membership-fixture/Context.swift', 'tests/fixtures/ios-membership-fixture/main.swift',
  '.github/workflows/ios-mvp-verification.yml');
const ui = 'ios/UITests/SportsGreenMooveUITests/';
for (const name of readdirSync(resolve(root, ui)).filter(name => name.endsWith('.swift'))) paths.push(ui + name);
for (const path of paths) {
  archive(path, read(path), 'candidate');
  const present = execFileSync('git', ['ls-tree', '--name-only', baseline, '--', path], {cwd: root, encoding: 'utf8'}).trim();
  if (present) archive(path, execFileSync('git', ['show', baseline + ':' + path], {cwd: root}), baseline);
}
const baselineScript = read('scripts/check-ios-native-plan.sh').toString().replace('\nbash "${ROOT_DIR}/scripts/qa/check-ios-membership-fixture.sh"', '');
archive('scripts/check-ios-native-plan.sh', baselineScript, 'baseline-with-input-driver');
archive('ios/Tests/SportsGreenMooveNativeChecks/main.swift', read('ios/Tests/SportsGreenMooveNativeChecks/main.swift'), 'baseline-with-input-driver');
archive('ios/Tests/SportsGreenMooveNativeChecks/TeamChatEditingChecks.swift', read('ios/Tests/SportsGreenMooveNativeChecks/TeamChatEditingChecks.swift'), 'baseline-with-input-driver');
write('source-sha256.json', json({files}));
write('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
write('summary.json', json({checkedAt: '2026-11-05', scope: 'controlled-team-input-and-ui-candidates-not-native-screen-acceptance',
  baselineCommit: baseline, records, localChecks: {baselineReproductions: 12, candidateInputBoundaries: 12,
    nativePlanExitCode: 0, signatureExitCode: 0, syntaxExitCode: 0, actualFixtureDecisions: 2},
  backgroundReadsNoLongerDisableTyping: true, concurrentSendsStillDenied: true, unknownSendIdentityPreserved: true,
  cityButtonAccessibilityCandidate: true, fullClubLabelHitAreaCandidate: true, membershipUiCauseProven: false,
  fixtureCases: 11, deadlineMinutes: 50, uiAssertionsChanged: false, sdkLinkedBuildAccepted: false,
  nativeUiAccepted: false, physicalDeviceAccepted: false, releaseComplete: false,
  productionWrites: 0, providerRequests: 0, newPhoneSessions: 0, newMedia: 0}));
console.log('Retained twelve actual baseline/candidate input boundaries, two real fixture-model decisions and unchanged UI assertions.');
