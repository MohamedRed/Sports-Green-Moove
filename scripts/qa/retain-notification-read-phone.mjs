import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createConnection } from 'node:net';

const [input, destination] = process.argv.slice(2);
assert(isAbsolute(input ?? '') && isAbsolute(destination ?? '') && !existsSync(destination));
assert(!existsSync(resolve(input, 'phone-session.json')), 'The private session must be removed first');
const helper = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-YnTyes';
assert(!existsSync(helper), 'The owned private helper directory must be removed');
const ports = [5001,8080,9000,9099,45690,45691];
for (const port of ports) await new Promise((ok, fail) => {
  const socket = createConnection({host: '127.0.0.1', port});
  socket.once('connect', () => {socket.destroy(); fail(new Error('Owned endpoint remains open: ' + port));});
  socket.once('error', error => error.code === 'ECONNREFUSED' ? ok() : fail(error));
  socket.setTimeout(1500, () => {socket.destroy(); fail(new Error('Endpoint state is unknown'));});
});
mkdirSync(destination, {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
const observer = JSON.parse(readFileSync(resolve(input, 'phone-checkpoints/session-results.json')));
assert.equal(observer.completed, true); assert.equal(observer.checkpoints.length, 4);
assert.equal(observer.adminClientClosed, true); assert.equal(observer.protectedRecordCount, 167);
mkdirSync(resolve(destination, 'phone')); mkdirSync(resolve(destination, 'captures'));
for (const name of ['initial', 'read', 'driver', 'reopened', 'session-results'])
  copyFileSync(resolve(input, 'phone-checkpoints', name + '.json'), resolve(destination, 'phone', name + '.json'));
for (const phase of ['unread', 'read', 'driver', 'parent-return'])
  copyFileSync(resolve(input, 'phone-' + phase + '.png'), resolve(destination, 'captures', phase + '.jpg'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(observer.sourceFiles)) {
  const bytes = readFileSync(file); assert.equal(hash(bytes), expected);
  const target = resolve(destination, 'source', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, bytes);
}
copyFileSync(resolve(input, 'phone-apk-identity.json'), resolve(destination, 'apk-identity.json'));
write('summary.json', {checkedAt: '2026-10-23', projectId: observer.projectId, runId: observer.runId,
  scope: 'physical-android-notification-read-and-sequential-account-switch-with-isolated-backend',
  appSourceCommit: '87082b10b44db59943089a21f82606f5a153be2b', observerSourceWasUncommitted: true,
  actualPhoneReadPassed: true, actualAccountSwitchPassed: true, parentReturnPassed: true,
  checkpointsPassed: 4, protectedRecordCount: 167, captures: ['unread', 'read', 'driver', 'parent-return'],
  processDeathAccepted: false, nativeProcessIdsMeasured: false, pushDeliveryAccepted: false,
  physicalTrackingAccepted: false, productionWrites: false, realMapsUsed: false, realPaymentsUsed: false,
  iosAccepted: false, videoAccepted: false, releaseComplete: false,
  lifecycleAttempt: 'Provider Kill App(s) displayed a force-kill-in-progress notice, but the stream remained on the same screen and process death was not measured. The reopened checkpoint establishes account return only.',
  inputPreparation: 'Remote keyboard focus and symbol forwarding required on-screen keyboard input. These preparation attempts are not accepted as flow results or published media.'});
write('cleanup.json', {backendExitCode: 130, helperExitCode: 130, credentialRemoved: true, helperDirectoryRemoved: true,
  observerClosed: true, phoneSessionStopped: true, dashboardObservedAfterStop: true,
  finalPhoneSignOutVerified: false, appUninstallVerified: false, launcherAbsenceVerified: false,
  portsClosed: ports, chromeRestarted: false, personalDevicesChanged: false,
  globalPhoneSettingsChanged: false, administrationPolicyChanged: false});
const hashes = {};
function walk(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(file); else hashes[file] = hash(readFileSync(resolve(destination, file)));
  }
}
walk(); write('artifact-sha256.json', hashes);
console.log('Retained four independent checkpoints and four reviewed phone captures; no restart or release acceptance.');
