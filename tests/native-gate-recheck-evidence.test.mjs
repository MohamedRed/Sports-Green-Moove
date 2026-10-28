import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {nativeGateFolder as folder, validateNativeGateRecheck} from '../scripts/qa/native-gate-recheck-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), reference = {source: folder + 'summary.json', checkedAt: '2026-10-28', checksums: folder + 'artifact-sha256.json'};
test('the current full native gate binds original execution, unchanged replay steps, primary copies and previous failures', () => {
  assert.equal(validateNativeGateRecheck(root, reference).ordinary.passed, 187);
  assert.deepEqual(content.nativeGateRecheck, reference);
});
const mutations = [
  ...['physicalDeviceAccepted', 'productionWrites', 'releaseComplete', 'earlierTransportRootCauseConfirmed',
    'realPaymentsExercised', 'safetyAuditAccepted', 'newMediaAccepted'].map(flag => ['summary.json', value => {value[flag] = true;}]),
  ['native-run.json', value => {value.jobs.find(job => job.name === 'Android native UI tests').conclusion = 'failure';}],
  ['pr-checks.json', value => {
    value.statusCheckRollup.find(check => check.name === 'iOS native checks').conclusion = 'SUCCESS';
    value.statusCheckRollup.find(check => check.name === 'Functions and Firebase rules').conclusion = 'SKIPPED';
  }],
  ['ordinary-results.json', value => {value.skipped = 53;}],
  ['replay/results.json', value => {value.steps.pop();}],
  ['replay/adb-pull-trip-change-parent-confirmation.json', value => {value.completed = false;}],
  ['device-restoration.json', value => {value.restoration.installAdmin.authorizationRemoved = false;}],
  ['previous/primary-copy.json', value => {value.completed = true;}],
  ['previous/native-suite-status.json', value => {value.localReplay = 0;}],
  ['replay/local-chat-network-ui.json', value => {value.network[2].backendReachable = true;}],
];
for (const [index, [file, mutate]] of mutations.entries()) test('a changed gate invariant is rejected after checksum replacement: ' + index, () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-native-gate-proof-'));
  try {
    const target = resolve(temporary, folder); cpSync(resolve(root, folder), target, {recursive: true});
    const archive = resolve(temporary, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
    symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
    const value = JSON.parse(readFileSync(resolve(target, file))); mutate(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(target, file), bytes);
    const hashes = JSON.parse(readFileSync(resolve(target, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(target, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateNativeGateRecheck(temporary, reference));
  } finally {rmSync(temporary, {recursive: true, force: true});}
});
test('public copy remains simulation-only without new screenshots or an invented transport repair', () => {
  const news = content.updates.find(row => row.source === folder + 'README.md');
  assert.match(news.title, /simulation/); assert.match(news.text, /conditions réelles/);
  assert.doesNotMatch(news.text, /BrowserStack|Firebase|Android|SDK|pipeline/);
  assert(content.blockers.some(row => row.id === 'native-evidence-copy'));
});
