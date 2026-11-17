import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';
import { scopedLocalSettings } from './scoped-browserstack-local.mjs';
import { teamAuthorityPhases } from './manual-team-authority-checkpoints.mjs';
import { teamAuthorityPhoneScope, validateTeamAuthorityPhone } from './team-authority-phone-evidence.mjs';

const [records, destination, runtime, handoff, sessionPath] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
for (const path of [records, destination, runtime, handoff, sessionPath]) assert(isAbsolute(path ?? ''));
assert(!existsSync(destination)); assert.match(basename(runtime), /^sgm-local-runtime-/); assert.match(basename(handoff), /^sgm-scoped-bs-/);
for (const path of [runtime, handoff, sessionPath]) assert(!existsSync(path), 'Owned test state still exists');
const processes = execFileSync('ps', ['-axo', 'pid,ppid,pgid,command'], {encoding: 'utf8'}).split('\n');
// This collector's own argument list names removed paths; only running test services count.
assert(!processes.some(line => !line.includes('collect-team-authority-phone-evidence.mjs') &&
  (line.includes(runtime) || line.includes(handoff))));
await assertLocalEndpointsClosed([5001, 8080, 9000, 9099]);
const session = JSON.parse(readFileSync(resolve(records, 'session-results.json'))); assert.equal(session.completed, true);
mkdirSync(destination);
const write = (name, value) => writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const name of readdirSync(records)) {
  assert(/^[\w.-]+\.(json|jpg|txt)$/.test(name)); copyFileSync(resolve(records, name), resolve(destination, name));
}
const archive = resolve(root, 'docs/release/evidence/source-archive');
for (const [path, hash] of Object.entries(session.sourceFiles)) {
  const original = readFileSync(resolve(root, path)); assert.equal(createHash('sha256').update(original).digest('hex'), hash);
  const target = resolve(archive, hash + '.txt');
  if (existsSync(target)) assert.deepEqual(readFileSync(target), original); else writeFileSync(target, original, {flag: 'wx'});
}
const captureSaveTimes = {};
for (const phase of teamAuthorityPhases) {
  const path = resolve(records, phase + '-context.jpg'); captureSaveTimes[phase] = statSync(path).mtime.toISOString();
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-vf', 'crop=250:558:626:110',
    '-frames:v', '1', '-q:v', '2', resolve(destination, phase + '-device.jpg')], {stdio: 'pipe'});
}
write('connection-policy.json', {settings: scopedLocalSettings, phoneToolbarActiveObserved: true,
  forceLocalUncheckedObserved: true, privateCredentialTransport: 'owner-only-named-pipes', credentialValuesRetained: false});
write('local-cleanup.json', {verifiedAt: new Date().toISOString(), privateSessionRemoved: true, privateHandoffRemoved: true,
  ownedRuntimeRemoved: true, ownedProcessesAbsent: true, loopbackPortsRefused: [5001, 8080, 9000, 9099],
  devicePolicyChanged: false, backendExitCode: 130, helperExitCode: 130, controllerExitCode: 0, packageInventoryIndependentlyRead: false});
write('results.json', {scope: teamAuthorityPhoneScope, projectId: session.projectId, runId: session.runId, testedAt: session.testedAt,
  appSourceCommit: '458318c3d7e64252d39c9458dd94cf04a06df79a',
  appSha256: '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44',
  appMainTree: execFileSync('git', ['rev-parse', '458318c:android/app/src/main'], {cwd: root, encoding: 'utf8'}).trim(),
  controllerSourceState: 'exact-executed-working-tree-bytes-retained-by-sha256',
  device: {model: 'Google Pixel 9', os: 'Android 15'},
  captureMethod: 'reviewed-browser-stream-context-with-declared-device-rectangle',
  captureRectangle: {left: 626, top: 110, width: 250, height: 558}, captureSaveTimes,
  publishedCaptures: Object.fromEntries(teamAuthorityPhases.map(id => ['team-authority-phone-' + id, id + '-device.jpg'])),
  physicalDevice: true, manualNativeUiObserved: true, guardianAccessChangesVerified: true, singleExplicitParentSend: true,
  managerUiProven: false, twoPhoneFlowVerified: false, notificationsVerified: false, trackingVerified: false,
  paymentExercised: false, productionWrites: false, releaseEvidenceAccepted: false, fullCiVerified: false,
  nativePngExportObtained: false, videoCaptured: false});
write('artifact-sha256.json', Object.fromEntries(readdirSync(destination).map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
validateTeamAuthorityPhone(root, resolve(destination, 'results.json'));
console.log('Retained five independently checked phone authority stages; no simultaneous-phone, push or release claim.');
