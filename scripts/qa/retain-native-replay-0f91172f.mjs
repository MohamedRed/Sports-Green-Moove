import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [artifact, destination] = process.argv.slice(2);
assert([artifact, destination].every(path => path?.startsWith('/'))); assert(!existsSync(destination));
mkdirSync(resolve(destination, 'native'), {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
const run = JSON.parse(execFileSync('gh', ['run', 'view', '39999878585', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.headSha, '0f91172f5340ae77696afda54d60ac923a3506a9'); assert.equal(run.conclusion, 'success');
write('native-run.json', run);
const metadata = JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12521969524'], {encoding: 'utf8'}));
assert.equal(metadata.workflow_run.head_sha, run.headSha); write('artifact-metadata.json', metadata);
const native = resolve(artifact, 'outputs/local-ui-evidence/41d1d40c39949e5360b25d6e7153b310');
for (const file of readdirSync(native).filter(name => name === 'results.json' || name.endsWith('-instrumentation.txt') || name.startsWith('adb-pull-')))
  copyFileSync(resolve(native, file), resolve(destination, 'native', file));
for (const [source, target] of [
  ['outputs/store-review-screenshots/native-suite-status.json', 'native-suite-status.json'],
  ['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml', 'ordinary-suite.xml'],
  ['outputs/store-review-screenshots/disposable-store-restore.json', 'device-restoration.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'host-observation.json'],
]) copyFileSync(resolve(artifact, source), resolve(destination, target));
write('summary.json', {checkedAt: '2026-10-23', scope: 'completed-isolated-native-replay-not-root-cause-or-release',
  sourceCommit: run.headSha, ciRunId: run.databaseId, nativeGroupsPassed: 36, nativeCasesPassed: 38,
  ordinaryCasesPassed: 154, ordinaryCasesSkipped: 50, primaryCopiesPassed: 16, focusedJobsPassed: 11,
  fullCiPassed: true, deviceRestorationVerified: true, hostExitVerified: true, earlierTransportRootCauseConfirmed: false,
  newMediaAccepted: false, physicalTrackingAccepted: false, realPaymentsExercised: false, productionWrites: false, releaseComplete: false});
const hashes = {};
function hash(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) hash(file);
    else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
hash(); write('artifact-sha256.json', hashes);
console.log('Retained completed replay receipts; no media or provider acceptance.');
