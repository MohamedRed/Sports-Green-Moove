import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { profileLedgerPhonePhases } from './profile-ledger-phone-checkpoints.mjs';

const root = resolve(import.meta.dirname, '../..'), [input, apkPath] = process.argv.slice(2);
const base = resolve(root, 'docs/release/evidence/profile-ledger-phone-2026-10-24');
const json = path => JSON.parse(readFileSync(path));
const report = json(resolve(input, 'session-results.json')); assert.equal(report.completed, true);
assert.equal(createHash('sha256').update(readFileSync(apkPath)).digest('hex'), json(apkPath + '.json').apkSha256);
for (const [file, hash] of Object.entries(report.sourceFiles))
  assert.equal(createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex'), hash);
assert(!existsSync(base)); mkdirSync(resolve(base, 'captures'), {recursive: true});
for (const file of ['baseline.json', 'session-results.json', ...profileLedgerPhonePhases.map(phase => phase + '.json')])
  copyFileSync(resolve(input, file), resolve(base, file));
for (const [file, hash] of Object.entries(report.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
}
const images = {'parent-ready.png': 'parent-ready.png', 'parent-city-saved.png': 'parent-city-saved.png',
  'parent-rewards.png': 'parent-rewards.png', 'driver-ready.png': 'driver-ready.png',
  'driver-rewards.png': 'screenshot-Google Pixel 9 Pro-15.0 (1).png',
  'driver-payments.png': 'screenshot-Google Pixel 9 Pro-15.0 (2).png',
  'parent-returned.png': 'screenshot-Google Pixel 9 Pro-15.0 (3).png',
  'parent-city-cleared.png': 'screenshot-Google Pixel 9 Pro-15.0 (4).png'};
for (const [name, original] of Object.entries(images)) copyFileSync(resolve(input, original), resolve(base, 'captures', name));
copyFileSync(apkPath + '.json', resolve(base, 'apk.json'));
const absent = path => !existsSync(path);
const cleanup = {signedOut: true, uninstallAcknowledged: true, sessionStopped: true, observerExited: true,
  privateSessionAbsent: absent('/private/tmp/sgm-phone-ledger-city-a55503a4-20261024.json'),
  runtimeAbsent: absent('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-WeZpEV'),
  helperDirectoriesAbsent: ['Wgrg5N', 'dzHV6P'].every(suffix => absent('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-' + suffix)),
  ownedHelperAbsent: spawnSync('/usr/bin/pgrep', ['-x', 'BrowserStackLocal'], {stdio: 'ignore'}).status === 1,
  portsClosed: [5001, 8080, 9000, 9099].every(port => spawnSync('/usr/sbin/lsof', ['-nP', '-iTCP:' + port, '-sTCP:LISTEN'], {stdio: 'ignore'}).status === 1),
  administrationUsed: false, installationPolicyChanged: false, packageAbsenceIndependentlyVerified: false};
const write = (name, value) => writeFileSync(resolve(base, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
write('cleanup.json', cleanup);
write('summary.json', {scope: 'physical-android-profile-ledger-with-isolated-data-not-production', checkedAt: '2026-10-24',
  sourceCommit: json(apkPath + '.json').sourceCommit, physicalDevice: true, device: 'Google Pixel 9 Pro', os: '15.0',
  uiObservation: 'manual-native-ui', independentCheckpoints: 9, originalScreenshotExports: 8,
  productionDeployed: false, releaseComplete: false, wholeProcessRestart: false, physicalTracking: false, realPayment: false, iosTested: false});
write('visual-review.json', {reviewed: true, containsRealCustomerData: false, credentialsVisible: false,
  originalNames: images, published: Object.fromEntries(Object.keys(images).filter(name => name !== 'driver-payments.png').map(name => [name, true])),
  excluded: {'driver-payments.png': 'Destination only; no onboarding, payment or transfer was submitted.'}});
console.log('Collected original phone exports and independent records; add the manual observation notes before checksumming.');
