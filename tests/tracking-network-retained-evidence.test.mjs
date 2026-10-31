import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {validateTrackingNetworkPhone} from '../scripts/qa/tracking-network-retained-evidence.mjs';
import {validateNativeClockCi} from '../scripts/qa/native-clock-ci-evidence.mjs';
import {validateNativeStatus} from '../partner-portal/native-status-validation.mjs';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/tracking-network-phone-2026-10-25';
const record = {source: folder + '/summary.json', checksums: folder + '/artifact-sha256.json', checkedAt: '2026-10-25'};
test('record recovery cannot accept the visibly stalled continuous phone display', () => {
  const result = validateTrackingNetworkPhone(root, record);
  assert.equal(result.uploadRecoveryObserved, true); assert.equal(result.overallFlowAccepted, false);
  const flow = content.flows.find(row => row.id === 'tracking-network');
  assert.deepEqual(flow.trackingNetworkPhone, record); assert.equal(flow.status, 'partial');
  assert.equal(flow.images.length, 3); assert.equal(flow.tour.length, 3);
  assert(content.blockers.some(row => row.id === 'tracking-reconnect-display'));
});
test('the independent clock case remains passing while the complete native CI run stays failed', () => {
  const summary = validateNativeClockCi(root, 'docs/release/evidence/native-clock-ci-30e1ebe-2026-10-25');
  assert.equal(summary.focusedClockCasePassed, true); assert.equal(summary.wholeRunAccepted, false);
  assert.equal(validateNativeStatus(root, content.blockers).fullGatePassed, false);
  assert(!content.blockers.some(row => row.id === 'native-startup-recheck'));
});
test('both new artifact sets are tracked, including original transcripts and source snapshots', () => {
  for (const path of [folder, 'docs/release/evidence/native-clock-ci-30e1ebe-2026-10-25']) {
    const hashes = JSON.parse(readFileSync(resolve(root, path, 'artifact-sha256.json')));
    const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', path], {cwd: root, encoding: 'utf8'}).split('\0'));
    for (const file of ['artifact-sha256.json', ...Object.keys(hashes)]) assert(tracked.has(path + '/' + file), file);
  }
});
const mutations = [
  ['summary.json', row => {row.automaticDisplayRecoveryProven = true;}],
  ['summary.json', row => {row.overallFlowAccepted = true;}],
  ['summary.json', row => {row.rootCauseConfirmed = true;}],
  ['records/offline-stale.json', row => {row.result.observedForMs = 49_999;}],
  ['records/offline-stale.json', row => {row.state.liveTrips[row.result.rideId].vehicle.uploadedAt++;}],
  ['display-stalled-backend-fresh.json', row => {row.backendAgeMs = 60_000;}],
  ['cleanup.json', row => {row.networkSimulationRestored = false;}],
  ['captures.json', row => {row.files['offline-stale'].visuallyReviewed = false;}],
];
for (const [file, mutate] of mutations) test('network evidence rejects an unsupported promotion: ' + file + ' ' + mutate, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-network-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, folder); cpSync(resolve(root, folder), base, {recursive: true});
  const value = JSON.parse(readFileSync(resolve(base, file))); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(resolve(base, file), bytes);
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateTrackingNetworkPhone(temp, record));
});
