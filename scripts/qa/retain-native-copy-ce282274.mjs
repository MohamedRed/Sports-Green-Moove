import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

const [artifact, team, fingerprint, destination] = process.argv.slice(2);
assert([artifact, team, fingerprint, destination].every(path => isAbsolute(path || ''))); assert(!existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (name, value) => writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + '\n');
const run = JSON.parse(execFileSync('gh', ['run', 'view', '39994935177', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); write('native-run.json', run);
const metadata = JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/runs/39994935177/artifacts'], {encoding: 'utf8'}));
for (const [name, file] of [['android-connected-ui-test-results', 'artifact-metadata.json'],
  ['android-focused-safety-ui-team-conversation', 'team-artifact-metadata.json']]) {
  const item = metadata.artifacts.find(item => item.name === name); assert(item); write(file, item);
}
const native = 'outputs/local-ui-evidence/a156f95da1f84aca09cc8fb1e0828878/';
for (const [from, to] of [
  [native + 'adb-pull-trip-change-parent-confirmation.json', 'primary-copy.json'],
  [native + 'adb-pull-failure-cleanup.json', 'cleanup-copy.json'],
  [native + 'LocalGuardianVerificationFlowTest-instrumentation.txt', 'guardian-instrumentation.txt'],
  [native + 'LocalTripChangeFlowTest-instrumentation.txt', 'trip-change-instrumentation.txt'],
  ['outputs/store-review-screenshots/disposable-store-restore.json', 'device-restoration.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'host-observation.json'],
  ['outputs/store-review-screenshots/native-suite-status.json', 'native-suite-status.json'],
]) copyFileSync(resolve(artifact, from), resolve(destination, to));
const teamNative = 'local-ui-evidence/5acb397063e7fb0f8900b3c0fda97de6/';
for (const [from, to] of [
  [teamNative + 'LocalTeamConversationFlowTest-instrumentation.txt', 'team-instrumentation.txt'],
  [teamNative + 'team-conversation-results.json', 'team-results.json'],
  [teamNative + 'team-conversation-app-results.json', 'team-app-results.json'],
  ['focused-safety-ui/team-conversation/disposable-device-restore.json', 'team-restoration.json'],
  ['focused-safety-ui/team-conversation/host-shutdown/complete.json', 'team-host-observation.json'],
]) copyFileSync(resolve(team, from), resolve(destination, to));
copyFileSync(fingerprint, resolve(destination, 'original-fingerprint-coverage.json'));
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: run.headSha,
  scope: 'terminal-native-copy-failure-with-passing-guardian-and-team-cases-not-release',
  guardianCasePassed: true, teamCasePassed: true, deviceRestorationVerified: true, hostExitVerified: true,
  fullCiPassed: false, earlierLoginRootCauseConfirmed: false, copyRootCauseConfirmed: false, newMediaAccepted: false,
  physicalTrackingAccepted: false, realPaymentExercised: false, productionWrites: false, releaseComplete: false});
const hashes = {};
for (const file of readdirSync(destination)) hashes[relative(destination, resolve(destination, file))] = createHash('sha256')
  .update(readFileSync(resolve(destination, file))).digest('hex');
write('artifact-sha256.json', hashes);
console.log('Retained the newer failed primary copy separately from passing native cases and cleanup.');
