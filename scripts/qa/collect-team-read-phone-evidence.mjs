import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import net from 'node:net';
import { scopedLocalSettings } from './scoped-browserstack-local.mjs';
import { teamReadPhonePhases } from './manual-team-read-checkpoints.mjs';
import { teamReadPhoneScope, validateTeamReadPhone } from './team-read-phone-evidence.mjs';

const [records, pictures, destination] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
for (const path of [records, pictures, destination]) assert(isAbsolute(path ?? ''));
assert(!existsSync(destination));
const session = JSON.parse(readFileSync(resolve(records, 'session-results.json'))); assert.equal(session.completed, true);
const runtime = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-X3Ph9r';
const handoff = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-9tfKBF';
assert(!existsSync(runtime) && !existsSync(handoff));
assert(!existsSync('/private/tmp/sgm-team-read-phone-session-interactive-20261021.json'));
const processes = execFileSync('ps', ['-axo', 'pid,ppid,pgid,command'], { encoding: 'utf8' }).split('\n');
assert(!processes.some(line => line.includes(runtime) || line.includes(handoff)));
for (const port of [5001, 8080, 9000, 9099]) await new Promise((resolveCheck, reject) => {
  const socket = net.connect({ host: '127.0.0.1', port }); socket.once('connect', () => { socket.destroy(); reject(new Error('Owned test port is still open')); });
  socket.once('error', error => error.code === 'ECONNREFUSED' ? resolveCheck() : reject(error));
});
mkdirSync(destination);
const write = (name, value) => writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const copy = (from, name) => copyFileSync(resolve(from, name), resolve(destination, name));
copy(records, 'session-results.json');
for (const id of teamReadPhonePhases) copy(records, id + '.json');
for (const name of readdirSync(pictures)) copy(pictures, name);
const archive = resolve(root, 'docs/release/evidence/source-archive');
for (const [path, hash] of Object.entries(session.sourceFiles)) {
  const original = readFileSync(resolve(root, path)); assert.equal(createHash('sha256').update(original).digest('hex'), hash);
  const target = resolve(archive, hash + '.txt');
  if (existsSync(target)) assert.deepEqual(readFileSync(target), original);
  else writeFileSync(target, original, { flag: 'wx' });
}
const captureSaveTimes = {};
for (const id of teamReadPhonePhases) {
  const path = resolve(pictures, id + '-context.jpg'); captureSaveTimes[id] = statSync(path).mtime.toISOString();
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-vf', 'crop=250:558:626:110',
    '-frames:v', '1', '-q:v', '2', resolve(destination, id + '-device.jpg')], { stdio: 'pipe' });
}
write('connection-policy.json', { settings: scopedLocalSettings, phoneToolbarActiveObserved: true,
  forceLocalUncheckedObserved: true, privateCredentialTransport: 'owner-only-named-pipes',
  observationMethod: 'operator-reviewed-toolbar-and-scoped-launcher-receipt', credentialValuesRetained: false });
write('local-cleanup.json', { verifiedAt: new Date().toISOString(), privateSessionRemoved: true, privateHandoffRemoved: true,
  ownedRuntimeRemoved: true, ownedProcessesAbsent: true, loopbackPortsRefused: [5001, 8080, 9000, 9099],
  devicePolicyChanged: false, initialRuntimeCleanupExitCode: 1, initialFailure: 'ENOTEMPTY on remaining cli-config directory',
  remainingCliConfigRemovedAfterProcessExit: true, helperExitCode: 130, controllerExitCode: 0, packageInventoryIndependentlyRead: false });
write('results.json', { scope: teamReadPhoneScope, projectId: session.projectId, runId: session.runId,
  testedAt: session.testedAt, sourceCommit: '458318c3d7e64252d39c9458dd94cf04a06df79a',
  appSha256: '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44',
  appMainTree: execFileSync('git', ['rev-parse', '458318c:android/app/src/main'], { cwd: root, encoding: 'utf8' }).trim(),
  device: { model: 'Google Pixel 9', os: 'Android 15' }, accountsInOrder: ['sgm-qa-parent', 'sgm-qa-driver', 'sgm-qa-parent'],
  captureMethod: 'reviewed-browser-stream-context-with-declared-device-rectangle',
  captureRectangle: { left: 626, top: 110, width: 250, height: 558 }, captureSaveTimes,
  publishedCaptures: Object.fromEntries(teamReadPhonePhases.map(id => ['team-read-phone-' + id, id + '-device.jpg'])),
  physicalDevice: true, manualNativeUiObserved: true, unreadStateVerified: true, singleExplicitParentSend: true,
  nativePngExportObtained: false, nativeExportFailure: 'Save dialog disabled in two destinations; no native PNG export accepted',
  boundedCaptureFailure: 'Two Page.captureScreenshot observation timeouts after first bounded capture; original browser contexts retained',
  nonInteractivePreparation: 'Exited 13 before UI checkpoints; owned first environment destroyed, interactive trial used a fresh environment',
  videoCaptured: false, twoPhoneFlowVerified: false, notificationsVerified: false, trackingVerified: false,
  paymentExercised: false, productionWrites: false, releaseEvidenceAccepted: false, fullCiVerified: false });
write('artifact-sha256.json', Object.fromEntries(readdirSync(destination).map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
validateTeamReadPhone(root, resolve(destination, 'results.json'));
console.log('Retained eight observed phone stages and independent read checkpoints; broader release requirements remain open.');
