import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {staleCancellationFolder, staleCancellationPublicImages, validateStaleCancellationPhone} from './cancellation-stale-phone-evidence.mjs';

const [input] = process.argv.slice(2); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, staleCancellationFolder);
assert(!existsSync(base)); mkdirSync(base, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => {
  mkdirSync(resolve(base, file, '..'), {recursive: true});
  writeFileSync(resolve(base, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
};
for (const [from, to] of [['stale-cancellation-phone-records', 'records'], ['stale-cancellation-phone-images', 'captures']]) {
  mkdirSync(resolve(base, to));
  for (const file of readdirSync(resolve(input, from))) copyFileSync(resolve(input, from, file), resolve(base, to, file), 1);
}
save('baseline-ci.json', execFileSync('gh', ['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'headRefOid,statusCheckRollup'], {encoding: 'utf8', timeout: 60_000}));
const phone = JSON.parse(readFileSync(resolve(base, 'records/session-results.json')));
const sources = {...phone.sourceFiles};
const handoff = {};
for (const path of ['scripts/qa/private-credential-form.mjs', 'scripts/qa/private-credential-form-page.mjs',
  'scripts/qa/read-private-credential-pipe.mjs', 'scripts/qa/browserstack-local-policy.mjs'])
  handoff[path] = sha(readFileSync(resolve(root, path)));
for (const [path, hash] of Object.entries({...sources, ...handoff})) {
  const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), hash, 'Tested source must remain unchanged');
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
}
save('handoff-source-sha256.json', handoff);
const absent = path => !existsSync(path);
const listeners = spawnSync('lsof', ['-nP', '-iTCP:5001', '-iTCP:8080', '-iTCP:9000', '-iTCP:9099', '-iTCP:49798', '-sTCP:LISTEN'], {encoding: 'utf8'});
assert.equal(listeners.status, 1); assert.equal(listeners.stdout, '');
const fixtureSessionAbsent = absent(resolve(input, 'stale-cancellation-phone-session.json'));
const runtimeDirectoryAbsent = absent('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-qg0HuC');
const helperDirectoryAbsent = absent('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-BOxZYB');
assert(fixtureSessionAbsent && runtimeDirectoryAbsent && helperDirectoryAbsent);
save('disposal.json', {scope: 'host-absence-and-manually-reviewed-provider-cleanup-not-independent-package-absence', observedAt: new Date().toISOString(),
  fixtureSessionAbsent, runtimeDirectoryAbsent, helperDirectoryAbsent, ownedPortsClosed: true, ports: [5001, 8080, 9000, 9099, 49798],
  privateInputClosed: true, helperGroupStopped: true, runtimeGroupStopped: true, hostClipboardRestored: true,
  providerIdleObserved: true, uninstallAcknowledged: true, independentPackageAbsenceProven: false,
  temporaryDeviceAdministratorUsed: false, installationPolicyChanged: false});
save('summary.json', {scope: 'physical-android-stale-cancellation-preview-with-isolated-peer-service-not-concurrent-two-phone-proof',
  testedAt: '2026-10-30', sourceCommit: 'dcd7a5e68ce860488db046bc86ea5dc0cda05593', sourceApkCommit: 'a1d0d96',
  sourceApkSha256: '3837331ce85b2cddadc39145f6ae2713f504ac590114a7c97d89763a3adc6642',
  phoneUiReviewed: true, recordResultsVerified: true, checkpoints: 8, publicImages: staleCancellationPublicImages,
  firstSignOutCaptureAccepted: false, finalSignOutCapture: 'signed-out-confirmed',
  concurrentTransactionOverlapProven: false, twoPhoneExchangeProven: false, peerPhoneUiProven: false,
  phoneWireAbortedCodeProven: false, pushDeliveryProven: false, installedBytesIndependentlyVerified: false,
  independentPackageAbsenceProven: false, realPayments: false, productionWrites: false, providerRequests: 0,
  videoRecorded: false, iosUiExecuted: false, releaseComplete: false});
const hashes = {};
for (const entry of readdirSync(base, {recursive: true, withFileTypes: true}).filter(entry => entry.isFile())) {
  const path = resolve(entry.parentPath, entry.name); hashes[path.slice(base.length + 1)] = sha(readFileSync(path));
}
save('artifact-sha256.json', hashes); console.log(JSON.stringify(validateStaleCancellationPhone(root)));
