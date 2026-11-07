import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';

const [artifact, phone, destination] = process.argv.slice(2);
assert([artifact, phone, destination].every(path => path?.startsWith('/')));
assert(!existsSync(destination)); mkdirSync(destination, {recursive: true});
const json = path => JSON.parse(readFileSync(path));
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
const copy = (source, file) => copyFileSync(source, resolve(destination, file));
const run = JSON.parse(execFileSync('gh', ['run', 'view', '39971115386', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.headSha, 'fa0cc1ffb94f7cba46b57f7dd04c354d2fb0e264');
assert.equal(run.conclusion, 'success'); write('native-run.json', run);
const metadata = JSON.parse(execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12510359398'],
  {encoding: 'utf8'})); write('artifact-metadata.json', metadata);
const native = resolve(artifact, 'outputs/local-ui-evidence/03aa50d6b3e7cc2ecc20ece7da696c74');
mkdirSync(resolve(destination, 'native'));
for (const file of readdirSync(native).filter(name => name === 'results.json' || name.endsWith('-instrumentation.txt') || name.startsWith('adb-pull-')))
  copy(resolve(native, file), 'native/' + file);
for (const [source, target] of [
  ['outputs/store-review-screenshots/native-suite-status.json', 'native-suite-status.json'],
  ['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml', 'ordinary-suite.xml'],
  ['outputs/store-review-screenshots/disposable-store-restore.json', 'native-restore.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'native-host-exit.json'],
]) copy(resolve(artifact, source), target);
mkdirSync(resolve(destination, 'phone')); mkdirSync(resolve(destination, 'captures'));
for (const file of readdirSync(resolve(phone, 'checkpoints-2')).filter(file => file.endsWith('.json')))
  copy(resolve(phone, 'checkpoints-2', file), 'phone/' + file);
const phases = ['started', 'picked-up', 'dropped-off', 'stable', 'completed', 'parent-history', 'review-prompt', 'reviewed'];
for (const phase of phases) copy(resolve(phone, 'phone-' + phase + '.png'), 'captures/' + phase + '.jpg');
for (const file of ['cleanup-signed-out.png', 'cleanup-uninstall-unverified.png', 'cleanup-session-stopped.png']) copy(resolve(phone, file), 'phone/' + file);
const credentialsRemoved = !existsSync(resolve(phone, 'session-2.json'));
assert(credentialsRemoved);
const ports = [5001, 8080, 9000, 9099, 45690, 45691];
for (const port of ports) await new Promise((done, reject) => {
  const socket = net.connect({port, host: '127.0.0.1'});
  socket.once('connect', () => { socket.destroy(); reject(new Error('Owned test endpoint remains open')); });
  socket.once('error', error => error.code === 'ECONNREFUSED' ? done() : reject(error));
});
write('cleanup.json', {checkedAt: new Date().toISOString(), credentialsRemoved, portsClosed: ports,
  backendExitCode: 130, helperExitCode: 130, helperDirectoryRemoved: true, phoneSignedOutObserved: true,
  phoneSessionStoppedObserved: true, uninstallVerified: false, phonePolicyChanged: false,
  limitation: 'Provider reported no removable user apps; native uninstall did not establish removal. Session explicitly stopped.'});
const sourceFiles = ['scripts/qa/manual-ride-phone-session.mjs', 'scripts/qa/manual-ride-phone-checkpoints.mjs'];
mkdirSync(resolve(destination, 'source'));
for (const file of sourceFiles) copy(resolve(file), 'source/' + file.split('/').at(-1));
write('summary.json', {checkedAt: '2026-10-23', scope: 'completed-native-replay-and-physical-ride-ui-with-isolated-data',
  sourceCommit: run.headSha, ciRunId: run.databaseId, nativeGroupsPassed: 36, nativeCasesPassed: 38,
  fullCiPassed: true, physicalPhoneUiPassed: true, phoneCheckpointsPassed: 7, baselineRecordsUnchanged: 158,
  apkSha256: createHash('sha256').update(readFileSync('/private/tmp/sgm-ride-status-phone-086263f3-localhost-20261023.apk')).digest('hex'),
  device: 'Google Pixel 9 Pro', androidVersion: '15.0', phoneAccountsSequential: true,
  screenshots: phases, captureMethod: 'unscaled-browser-stream-rectangle-254x559', videoAccepted: false,
  bookingDecisionPerformedOnPhone: false, confirmedDistanceKm: null, physicalTrackingAccepted: false,
  productionWrites: false, realPaymentExercised: false, earlierTransportRootCauseConfirmed: false, releaseComplete: false});
const hashes = {};
function hashFiles(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) hashFiles(file);
    else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
hashFiles(); write('artifact-sha256.json', hashes);
console.log('Retained reviewed ride recheck evidence without session credentials.');
