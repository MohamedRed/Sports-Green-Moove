import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import net from 'node:net';
import {cropInvitationSession, invitationAliasCaptures, invitationAliasFolder} from './invitation-alias-phone-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), input = '/Users/mrr/.codex/tmp';
const runtime = resolve(input, 'sgm-invitation-alias-browser-20261102');
const images = resolve(input, 'sgm-invitation-alias-phone-captures-20261102');
const folder = resolve(root, invitationAliasFolder); assert(!existsSync(folder));
const privateSession = resolve(input, 'sgm-invitation-alias-phone-private-20261102/session.json');
assert(!existsSync(privateSession) && !existsSync(privateSession + '.signup'));
const helper = '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-zWoo2Y';
assert(!existsSync(helper));
for (const port of [5001, 8080, 9000, 9099, 4185, 55158, 55337, 55358, 55375, 55391, 55500])
  await new Promise((closed, reject) => {
    const socket = net.connect(port, '127.0.0.1'); socket.once('connect', () => {socket.destroy(); reject(new Error('Owned endpoint still open'));});
    socket.once('error', error => error.code === 'ECONNREFUSED' ? closed() : reject(error));
  });
mkdirSync(resolve(folder, 'originals'), {recursive: true}); mkdirSync(resolve(folder, 'captures'));
const write = (file, value) => writeFileSync(resolve(folder, file), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of ['observations.json', 'connection-blocked-records.json', 'disposal.json'])
  copyFileSync(resolve(runtime, file), resolve(folder, file), 1);
copyFileSync(resolve(images, 'uninstall-observation.txt'), resolve(folder, 'uninstall-observation.txt'), 1);
for (const id of invitationAliasCaptures) {
  const bytes = readFileSync(resolve(images, id + '.jpg'));
  write('originals/' + id + '.jpg', bytes); write('captures/' + id + '.png', cropInvitationSession(bytes));
}
const observations = JSON.parse(readFileSync(resolve(folder, 'observations.json')));
const paths = ['scripts/qa/browserstack-local-policy.mjs', 'scripts/qa/scoped-browserstack-local.mjs',
  'scripts/qa/start-scoped-browserstack-local.mjs', 'scripts/qa/run-scoped-browserstack-local.mjs',
  'scripts/qa/observe-invitation-connection-block.mjs', 'scripts/qa/private-credential-form.mjs',
  'scripts/qa/private-fixture-input.mjs'];
const supportSources = Object.fromEntries(paths.map(file => [file, sha(readFileSync(resolve(root, file)))]));
for (const [file, expected] of Object.entries({...observations.sourceFiles, ...supportSources})) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(sha(bytes), expected);
  const archive = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (existsSync(archive)) assert(readFileSync(archive).equals(bytes)); else writeFileSync(archive, bytes, {flag: 'wx'});
}
write('support-source-files.json', supportSources);
write('uninstall-operator-observation.json', {
  scope: 'operator-reviewed-live-session-acknowledgement-not-independent-package-proof', observedOn: '2026-11-02',
  message: 'Succesfully uninstalled your app(s)!', savedAxWasDeltaOnly: true,
  savedAxAloneProvesUninstall: false, independentPackageAbsenceProven: false,
});
write('phone-and-helper-disposal.json', {sessionStopped: true, uninstallAcknowledged: true,
  independentPackageAbsenceProven: false, nativeSignInPerformed: false, devicePolicyChanged: false,
  hostBrowserPermissionChanged: false, helperRequestedStop: true, helperGroupExitVerified: true,
  helperDirectoryAbsent: true, helperExitCode: 130, privateInputsAbsent: true, hostClipboardRestored: true,
  privateInputListenersClosed: true});
write('review.json', {scope: 'physical-phone-private-alias-form-and-mismatch-not-signup-or-root-cause-proof',
  sourceCommit: observations.applicationHead, projectId: observations.projectId, runId: observations.runId,
  testedAt: '2026-11-02', physicalPhoneObserved: true, phoneModel: 'Google Pixel 9 Pro', osVersion: '15.0',
  selectedApkSha256: '507c3fa6bb2e9bdc6139162b2cd4d6dd2de1770f876b0dfce7395a8c9c9b8c17',
  installedApkIndependentlyHashed: false, browserAlias: 'bs-local.com', approvedExtraLoopbackPort: 4185,
  browserAliasEnabled: true, browserFormReached: true, mismatchRefused: true, childAccountCreated: false,
  parentApprovalProven: false, nativeShareToSignupProven: false, helperConnectionContinuityProven: false,
  rootCauseConfirmed: false, productionWrites: false, realPayments: false, requestLoggingEnabled: false,
  resolveAllUrlsEnabled: false, mapRequests: 0, publicCapturesAdded: 3, credentialsMaskedInRetainedCaptures: true,
  publicCropsReviewed: false, videoRecorded: false, releaseComplete: false});
const hashes = Object.fromEntries(readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile())
  .map(row => {const path = resolve(row.parentPath, row.name); return [path.slice(folder.length + 1), sha(readFileSync(path))];}));
write('artifact-sha256.json', hashes);
console.log('Retained the partial alias trial; visually review crops before setting its review flag.');
