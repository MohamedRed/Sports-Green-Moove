import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {validateTrackingClockReplay} from '../scripts/qa/tracking-clock-replay-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/tracking-clock-replay-2026-10-25';
const record = {source: folder + '/summary.json', checksums: folder + '/artifact-sha256.json', checkedAt: '2026-10-25'};
test('physical driver GPS advances in foreground/background and stops after sign-out without accepting release scope', () => {
  const result = validateTrackingClockReplay(root, record);
  const flow = content.flows.find(row => row.id === 'tracking');
  assert.deepEqual(flow.trackingClockReplay, record); assert.equal(flow.status, 'partial');
  assert.equal(result.originalObserverCompleted, false); assert.equal(result.releaseScenariosAccepted, false);
  assert.equal(flow.images.length, 3); assert.equal(flow.tour.length, 3);
  assert(!content.blockers.some(row => row.id === 'tracking-clock'));
});
test('the complete phone and failed local artifact set survives a fresh checkout', () => {
  const hashes = JSON.parse(readFileSync(resolve(root, folder, 'artifact-sha256.json')));
  const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', folder], {cwd: root, encoding: 'utf8'}).split('\0'));
  for (const file of ['artifact-sha256.json', ...Object.keys(hashes)]) assert(tracked.has(folder + '/' + file), file);
});
const mutations = [
  ['summary.json', row => {row.outdoorMovementProven = true;}],
  ['summary.json', row => {row.connectedLocalCasePassed = true;}],
  ['summary.json', row => {row.releaseScenariosAccepted = true;}],
  ['records/session-results.json', row => {row.completed = true;}],
  ['records/background-moved.json', row => {row.state.liveTrips[row.result.rideId].vehicle.lat = 0;}],
  ['records/supplemental-signed-out-stable.json', row => {row.observedForMs = 49_999;}],
  ['records/supplemental-signed-out-stable.json', row => {row.state.liveTrips[row.result.rideId].vehicle.uploadedAt++;}],
  ['cleanup.json', row => {row.endpointsClosed = false;}],
  ['captures.json', row => {row.files['foreground-first'].source = 'native-resolution-export';}],
];
for (const [file, mutate] of mutations) test('replay rejects unsupported claims: ' + file + ' ' + mutate, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-clock-replay-test-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, folder); cpSync(resolve(root, folder), base, {recursive: true});
  const value = JSON.parse(readFileSync(resolve(base, file))); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(resolve(base, file), bytes);
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateTrackingClockReplay(temp, record));
});
test('supplemental observation is read-only and never rewrites the original report', () => {
  const source = readFileSync(resolve(root, 'scripts/qa/observe-tracking-sign-out.mjs'), 'utf8');
  assert(source.includes('await setTimeout(50_000)')); assert(source.includes('JSON.parse(JSON.stringify(await snapshotSessionRestorationRecords'));
  assert(!source.includes('signIn(')); assert(!source.includes("call('"));
  assert(source.includes('originalObserverCompleted: false')); assert(source.includes("{mode: 0o600, flag: 'wx'}"));
});
