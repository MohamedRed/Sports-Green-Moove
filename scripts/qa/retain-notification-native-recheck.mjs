import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { validateNotificationNativeRecheck } from './notification-native-recheck-evidence.mjs';

const [artifact, destination] = process.argv.slice(2);
assert(isAbsolute(artifact || '') && isAbsolute(destination || '')); assert(!existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
const run = JSON.parse(execFileSync('gh', ['run', 'view', '39988296119', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.headSha, 'c1d2a2ff017b89fe498b2537854dc5a64e6d4a0c'); assert.equal(run.conclusion, 'failure');
write('native-run.json', run);
write('artifact-metadata.json', JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12517786813'], {encoding: 'utf8'})));
for (const [from, to] of [
  ['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml', 'ordinary-suite.xml'],
  ['outputs/store-review-screenshots/ordinary-instrumentation.txt', 'ordinary-instrumentation.txt'],
  ['outputs/store-review-screenshots/ordinary-process.json', 'ordinary-process.json'],
  ['outputs/store-review-screenshots/ordinary-results.json', 'ordinary-results.json'],
  ['outputs/store-review-screenshots/native-suite-status.json', 'native-suite-status.json'],
  ['outputs/store-review-screenshots/disposable-store-restore.json', 'device-restoration.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'host-observation.json'],
  ['outputs/matrix-apks/manifest.json', 'apk-manifest.json'],
]) copyFileSync(resolve(artifact, from), resolve(destination, to));
const sources = ['android/app/src/main/java/be/sportgreenmoove/app/services/AndroidNotificationSettings.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/NotificationSettingsState.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/NotificationSettingsRow.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/services/AndroidNotificationSettingsTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NotificationSettingsFlowTest.kt'];
const hashes = {};
for (const file of sources) {
  const bytes = execFileSync('git', ['show', run.headSha + ':' + file]);
  const path = resolve(destination, 'source', file + '.txt'); mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, bytes);
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
}
write('source-sha256.json', hashes);
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: run.headSha,
  scope: 'executed-notification-components-inside-failed-native-replay-not-push-or-phone', nativeCasesPassed: 7,
  ordinaryCasesPassed: 154, ordinaryCasesSkipped: 50, deviceRestorationVerified: true, hostExitVerified: false,
  fullCiPassed: false, pushDeliveryAccepted: false, actualNotificationSent: false, newPhysicalPhoneTrial: false,
  iosAccepted: false, productionWrites: false, realMoneyUsed: false, earlierLoginRootCauseConfirmed: false, releaseComplete: false});
const artifacts = {};
const walk = folder => {
  for (const entry of readdirSync(folder, {withFileTypes: true})) {
    const file = resolve(folder, entry.name);
    if (entry.isDirectory()) walk(file);
    else artifacts[relative(destination, file)] = createHash('sha256').update(readFileSync(file)).digest('hex');
  }
};
walk(destination); write('artifact-sha256.json', artifacts);
validateNotificationNativeRecheck('/', {source: resolve(destination, 'summary.json'), checkedAt: '2026-10-23', checksums: resolve(destination, 'artifact-sha256.json')});
console.log('Retained seven executed notification cases without promoting the failed replay.');
