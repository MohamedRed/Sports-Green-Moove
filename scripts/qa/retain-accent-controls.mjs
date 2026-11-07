import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const input = process.argv[2]; assert.equal(process.argv.length, 3); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), output = resolve(root, 'docs/release/evidence/accent-controls-phone-2026-10-30');
assert(!existsSync(output), 'Retained trials are immutable');
mkdirSync(output); for (const name of ['before', 'after', 'captures', 'records', 'preparation']) mkdirSync(resolve(output, name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), files = [];
const copy = (source, target = source) => {copyFileSync(resolve(input, source), resolve(output, target)); files.push(target);};
const save = (name, value) => {writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); files.push(name);};
for (const file of ['contrast-failed.xml', 'source-sha256.json', 'SgmColors.kt.txt', 'SgmTheme.kt.txt', 'V2Components.kt.txt', 'SgmAccentContrastTest.kt.txt'])
  copy('before/' + file);
for (const file of ['contrast-passed.xml', 'source-sha256.json']) copy('after/' + file);
const archive = resolve(root, 'docs/release/evidence/source-archive');
for (const stage of ['before', 'after']) {
  const sources = JSON.parse(readFileSync(resolve(input, stage, 'source-sha256.json')));
  for (const [path, hash] of Object.entries(sources)) {
    const original = stage === 'before' ? path.split('/').at(-1) + '.txt' : hash + '.txt';
    const bytes = readFileSync(resolve(input, stage, original)); assert.equal(sha(bytes), hash);
    if (stage === 'after') assert.deepEqual(readFileSync(resolve(root, path)), bytes);
    const destination = resolve(archive, hash + '.txt');
    if (existsSync(destination)) assert.deepEqual(readFileSync(destination), bytes); else writeFileSync(destination, bytes, {flag: 'wx'});
  }
}
const phases = ['home', 'search-light', 'search-dark', 'trips-dark', 'rewards-dark', 'rewards-light', 'signed-out'];
for (const phase of phases) for (const suffix of ['.png', '-session.jpg', '-capture.json']) copy('phone-images/' + phase + suffix, 'captures/' + phase + suffix);
for (const phase of ['baseline', 'before', ...phases, 'results']) copy('phone-records-recheck/' + phase + '.json', 'records/' + phase + '.json');
const observed = JSON.parse(readFileSync(resolve(output, 'records/results.json')));
assert.equal(observed.completed, true); assert.equal(observed.failure, false);
for (const [path, hash] of Object.entries(observed.sourceFiles)) {
  const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), hash);
  const destination = resolve(archive, hash + '.txt');
  if (existsSync(destination)) assert.deepEqual(readFileSync(destination), bytes); else writeFileSync(destination, bytes, {flag: 'wx'});
}
for (const file of ['disposal.json', 'phone-disposal.json', 'uninstall-observation.json']) copy(file);
copy('constructor-failed.xml', 'preparation/constructor-failed.xml');
copy('constructor-source.kt.txt', 'preparation/constructor-source.kt.txt');
copy('phone-records/failure.json', 'preparation/observer-failure.json');
copy('phone-records/results.json', 'preparation/observer-results.json');
const apkHash = sha(readFileSync(resolve(input, 'sgm-accent-controls-20261030.apk')));
assert.equal(apkHash, 'd0e3daa86874e6f0d2aa6f4e8765dc820c1dc0062e501de0d62f7f0cdad6a5a2');
save('review.json', {scope: 'physical-session-visual-accent-controls-not-full-accessibility-or-payment',
  reviewedAt: '2026-10-30', projectId: 'demo-sgm-local-qa', runId: observed.runId,
  device: {model: 'Google Pixel 9 Pro', androidVersion: '15.0', physicalDevice: true},
  apk: {filename: 'sgm-accent-controls-20261030.apk', sha256: apkHash, packageId: 'be.sportgreenmoove.app.local',
    sourceHead: '753f0a42f0d62e81caa316b979b9a256c81e1751', cleanCheckoutAttested: false,
    workingTreeSourcesRetained: true, installedBytesIndependentlyVerified: false},
  phases, published: ['search-light', 'search-dark', 'trips-dark', 'rewards-dark', 'rewards-light'],
  visualOverlapObserved: false, nativeScreenshotExports: false, actualUiFlowsExecuted: true,
  withdrawalInvoked: false, realPaymentExercised: false, mapRequests: 0, productionWrites: false,
  iosUiExecuted: false, screenReaderVerified: false, fullAppAccessibilityAccepted: false,
  gradientContrastAccepted: false, warningErrorTextAccepted: false, releaseAccepted: false,
  helperScope: {ports: [5001, 8080, 9000, 9099], forceLocal: false, requestLogging: false,
    aliasEnabled: false, invitationPagePortEnabled: false},
  preparationFailuresAcceptedAsProductFailures: false});
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(output, file)))])));
console.log(JSON.stringify({output, runId: observed.runId, captures: phases.length, published: 5}));
