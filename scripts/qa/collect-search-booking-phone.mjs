import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..'), [input, redPath, greenPath, beforeRoot, apkPath] = process.argv.slice(2);
const base = resolve(root, 'docs/release/evidence/search-booking-phone-2026-10-24');
assert(!existsSync(base));
const json = file => JSON.parse(readFileSync(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const phone = json(resolve(input, 'phone-records.json')), red = json(redPath), green = json(greenPath), apk = json(apkPath + '.json');
assert.equal(phone.completed, true); assert.equal(green.completed, true); assert.equal(red.completed, false);
assert.equal(sha(readFileSync(apkPath)), apk.apkSha256);
const diff = execFileSync('git', ['diff', '--name-only', apk.sourceCommit, '--', 'android/app/src/main', 'android/app/build.gradle.kts', 'functions/src'], {cwd: root, encoding: 'utf8'});
assert.equal(diff, '', 'The reused app and backend sources must still be unchanged');
mkdirSync(resolve(base, 'captures'), {recursive: true});
const write = (name, data) => writeFileSync(resolve(base, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
for (const name of ['allowance.json', 'baseline.json', 'final-state.json', 'phone-records.json', 'provider.json', 'runtime-cleanup.json',
  'requested.json', 'approved.json', 'parent-returned.json', 'cancelled.json']) copyFileSync(resolve(input, name), resolve(base, name));
const captures = ['choices', 'match', 'requested', 'driver-approved', 'parent-approved', 'cancelled', 'capacity-restored'];
for (const name of captures) copyFileSync(resolve(input, name + '.png'), resolve(base, 'captures', name + '.png'));
copyFileSync(redPath, resolve(base, 'services-red.json')); copyFileSync(greenPath, resolve(base, 'services-green.json'));
copyFileSync(apkPath + '.json', resolve(base, 'apk.json'));
for (const [report, sourceRoot] of [[red, beforeRoot], [green, root], [phone, root]]) {
  for (const [file, expected] of Object.entries(report.sourceFiles)) {
    const location = sourceRoot === beforeRoot && file.startsWith('functions/') ? resolve(root, file) : resolve(sourceRoot, file);
    const bytes = readFileSync(location); assert.equal(sha(bytes), expected, file);
    const target = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
    if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  }
}
const gone = path => !existsSync(path);
write('phone-cleanup.json', {signedOut: true, uninstallAcknowledged: true, sessionStopped: true, observerExited: true,
  observerExitCode: 0, runtimeExitCode: 0, helperExitCode: 130,
  privateSessionAbsent: gone('/private/tmp/sgm-search-booking-phone-39556738-20261024.json'),
  runtimeAbsent: gone('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-SUswHM'),
  helperDirectoryAbsent: gone('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-js8oVD'),
  helperProcessAbsent: spawnSync('/usr/bin/pgrep', ['-x', 'BrowserStackLocal'], {stdio: 'ignore'}).status === 1,
  portsClosed: [5001, 8080, 9000, 9099].every(port => spawnSync('/usr/sbin/lsof', ['-nP', '-iTCP:' + port, '-sTCP:LISTEN'], {stdio: 'ignore'}).status === 1),
  administrationUsed: false, installationPolicyChanged: false, packageAbsenceIndependentlyVerified: false,
  observationScope: 'manual-phone-ui-plus-host-probes-not-package-inventory'});
write('summary.json', {scope: 'physical-android-child-search-two-seat-booking-isolated-not-production',
  testedAt: phone.recordedAt, checkedAt: '2026-10-24', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  apkSourceCommit: apk.sourceCommit, appAndBackendDiffToApkSourceEmpty: true,
  physicalDevice: true, device: 'Google Pixel 9 Pro', os: '15.0', uiObservation: 'manual-native-ui',
  requestedSeats: 2, childId: 'sgm-qa-child-lina', capacitySequence: [4, 4, 2, 2, 4],
  actualMapRequests: 6, approvedMapRequestLimit: 8, matrixElements: 9, independentCheckpoints: 4,
  parentRequestedInApp: true, driverApprovedInApp: true, parentCancelledInApp: true,
  originalCaptures: captures.length, productionWrites: false, productionDeployed: false,
  simultaneousPhones: false, physicalTracking: false, wholeProcessRestart: false, realPayment: false, iosTested: false, releaseComplete: false});
write('visual-review.json', {reviewed: true, containsRealCustomerData: false, credentialsVisible: false,
  published: Object.fromEntries(captures.map(name => [name + '.png', true])),
  outsideBundle: {'driver-pending-browser.png': 'Provider/browser context retained privately, not a public gallery asset.'}});
console.log('Original phone evidence and exact red/green replay sources retained. Add notes before checksumming.');
