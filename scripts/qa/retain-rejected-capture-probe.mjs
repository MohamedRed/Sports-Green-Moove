import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {rejectedCaptureFolder, validateRejectedCaptureProbe} from './rejected-capture-probe-evidence.mjs';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

const [input, mode] = process.argv.slice(2); assert(isAbsolute(input ?? '')); assert(mode === undefined || mode === '--append-ci');
const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, rejectedCaptureFolder);
if (mode === undefined) {
assert(!existsSync(destination)); mkdirSync(destination);
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), files = [];
const sourceBase = '1cc8f12e19db286491f1ec6dfff76be0ba836946';
for (const [name, source] of [['baseline', 'team-capture-baseline'], ['failed', 'rejected-capture-candidate'], ['fresh', 'rejected-capture-fresh']]) {
  const from = resolve(input, source), to = resolve(destination, name); mkdirSync(to);
  const selected = readdirSync(from).filter(file => file.endsWith('.png') || /^(?:results|device-setup|device-restored|rejected-primary-copy|adb-pull-team-chat-components|team-chat-(?:narrow|denied|unconfirmed|confirmed))\.json$/.test(file)
    || file === 'instrumentation.txt' || file.endsWith('-process-log.txt') || file.endsWith('-exit-info.txt'));
  for (const file of selected) {copyFileSync(resolve(from, file), resolve(to, file)); files.push(name + '/' + file);}
  const result = JSON.parse(readFileSync(resolve(to, 'results.json')));
  for (const [file, expected] of Object.entries(result.sourceFiles)) {
    const bytes = name === 'baseline' ? execFileSync('git', ['show', sourceBase + ':' + file]) : readFileSync(resolve(root, file));
    assert.equal(hash(bytes), expected, file);
    const archive = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
    if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
  }
}
copyFileSync(resolve(input, 'team-capture-baseline-setup.json'), resolve(destination, 'baseline/original-device-setup.json'));
files.push('baseline/original-device-setup.json');
const summary = {scope: 'local-rejected-capture-probe-not-root-cause-or-release-acceptance', checkedAt: '2026-10-30', sourceBase,
  baselineComponentCases: 3, candidateComponentCases: 3, diagnosticCalibrationCases: 4, startupFailureBeforeCases: true,
  primaryApiModified: false, primaryDeadlineModified: false, outerRetryAdded: false, alternateImageAccepted: false,
  rootCauseProven: false, realCiRejectionReproduced: false, releaseAccepted: false, newMediaAccepted: false,
  physicalDevice: false, productionWrites: false};
writeFileSync(resolve(destination, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'}); files.push('summary.json');
writeFileSync(resolve(destination, 'artifact-sha256.json'), JSON.stringify(Object.fromEntries(files.map(file =>
  [file, hash(readFileSync(resolve(destination, file)))])), null, 2) + '\n', {flag: 'wx'});
}
assertEvidenceBundleChecksums(destination);
const ci = resolve(destination, 'current-ci'); assert(!existsSync(ci)); mkdirSync(ci);
const raw = resolve(input, 'main-1cc8f12-failed/outputs'), names = [];
const copy = (from, file) => {copyFileSync(resolve(from, file), resolve(ci, file)); names.push(file);};
for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'adb-host-component-transfer.json'])
  copy(resolve(raw, 'store-review-screenshots'), file);
for (const file of ['local-chat-network-ui.json', 'chat-network-validation-before.json', 'chat-network-validation-after.json',
  'LocalChatNetworkFlowTest-instrumentation.txt']) copy(resolve(raw, 'local-ui-evidence/6fec7fb47e3457b06143b680e0c84aad'), file);
for (const [file, path] of [['job.json', 'jobs/124066142558'], ['artifact.json', 'artifacts/12978553187']]) {
  writeFileSync(resolve(ci, file), execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/' + path], {timeout: 60_000}), {flag: 'wx'});
  names.push(file);
}
const hashes = JSON.parse(readFileSync(resolve(destination, 'artifact-sha256.json')));
for (const file of names) hashes['current-ci/' + file] = createHash('sha256').update(readFileSync(resolve(ci, file))).digest('hex');
writeFileSync(resolve(destination, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
validateRejectedCaptureProbe(root);
console.log('Unchanged three-case baseline, pre-UI failure and seven-case fresh calibration retained separately; no root-cause or release acceptance.');
