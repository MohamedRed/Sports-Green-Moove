import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {assertContextReplayPhone, contextReplayFolder, validateContextReplayEvidence} from '../scripts/qa/review-context-replay-evidence.mjs';
import {assertContextProcessRecovery, latestMeminfo} from '../scripts/qa/review-context-replay-process.mjs';
import {assertContextReplayGate} from '../scripts/qa/review-context-replay-gate.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, contextReplayFolder);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
const phoneReport = () => [json('summary'), json('phone/session-results'), json('ui-review'), json('disposal')];
function processReport() {
  return [...['before', 'stopped', 'reopened', 'package-removed'].map(phase => json('process/' + phase)),
    json('phone/session-results').runId, Object.fromEntries(['before', 'stopped', 'reopened'].map(phase =>
      [phase, readFileSync(resolve(base, 'process/' + phase + '-ax.txt'), 'utf8')]))];
}
test('the eight-checkpoint phone replay closes auth/process recovery but not network/iOS/release scope', () => {
  const result = validateContextReplayEvidence(root, content.reviewContextPhoneReplay);
  assert.equal(result.gate.contextualComponentCases, 3);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.tour.length, 4);
  assert.equal(flow.images.filter(row => !['review-network-phone-', 'review-receipt-phone-'].some(prefix => row.file.startsWith(prefix))).length, 38);
  assert(flow.tour.every(row => row.image.startsWith('review-page-')));
  assert.match(flow.remaining, /iPhone/);
  const current = flow.images.filter(row => row.file.startsWith('review-trip-replay-')); assert.equal(current.length, 7);
  for (const row of current) {assert(captures[row.file].startsWith(contextReplayFolder)); assert.match(row.alt, /comptes de test, capture de session du 29 octobre/);}
  assert(!content.blockers.some(row => row.id === 'native-primary-capture'));
  assert.equal(json('phone/session-results').checks.at(-1).ratingCount, 33);
});
for (const key of ['realNetworkLossVerified', 'iosUiExecuted', 'installedBytesIndependentlyVerified', 'realPayments',
  'productionWrites', 'releaseComplete', 'earlierInputRootCauseConfirmed']) test('rejects promotion of ' + key, () => {
  const report = phoneReport(); report[0][key] = true; assert.throws(() => assertContextReplayPhone(...report));
});
for (const [name, mutate] of [
  ['a missing checkpoint', rows => {rows[1].checks.pop();}],
  ['fixture-supplied final reviews', rows => {rows[1].subsequentRatingsFixtureSubmitted = true;}],
  ['first-page truncation after submission', rows => {rows[1].checks[5].parentRequests = 20;}],
  ['a dropped legacy request', rows => {rows[1].checks[6].unavailableParentRequests = 0;}],
  ['an altered original record', rows => {rows[1].checks[7].originalRecordsAndClaimsPreserved = false;}],
  ['a client left open', rows => {rows[1].firestoreClientTerminated = false;}],
  ['an invented received count', rows => {rows[2].parentSummary.count = 33;}],
  ['no final sign-out', rows => {rows[2].finalSignOutObserved = false;}],
  ['an open runtime endpoint', rows => {rows[3].ports[0].closed = false;}],
]) test('rejects ' + name, () => {const rows = phoneReport(); mutate(rows); assert.throws(() => assertContextReplayPhone(...rows));});
test('fragmented terminal output is bound to its original command snapshot and ignores old history', () => {
  const rows = processReport(); assert(!rows[2].visibleOutput.includes(rows[2].command));
  assert.equal(latestMeminfo(rows[1], rows[5].stopped), null);
  assert.deepEqual(assertContextProcessRecovery(...rows), {beforePid: 28786, reopenedPid: 19239});
});
for (const [name, mutate] of [
  ['a foreign package command', rows => {rows[0].command = 'dumpsys meminfo another.app';}],
  ['an output not in its original snapshot', rows => {rows[2].visibleOutput = 'invented';}],
  ['a stale final command without its result', rows => {rows[5].reopened += '\n' + rows[2].command;}],
  ['the old PID presented as the reopened PID', rows => {rows[2].pid = rows[0].pid;}],
  ['a missing stopped observation', rows => {rows[5].stopped = rows[5].before;}],
  ['out-of-order observations', rows => {rows[2].observedAt = rows[0].observedAt;}],
  ['unverified package removal', rows => {rows[3].visibleOutput = 'uninstall requested';}],
]) test('rejects ' + name, () => {const rows = processReport(); mutate(rows); assert.throws(() => assertContextProcessRecovery(...rows));});
for (const [file, mutate] of [
  ['native-run.json', row => {row.conclusion = 'failure';}],
  ['native-run.json', row => {row.jobs.find(job => job.name.includes('team-conversation')).conclusion = 'failure';}],
  ['pr-checks.json', row => {row.statusCheckRollup[0].status = 'IN_PROGRESS';}],
  ['native-artifact.json', row => {row.workflow_run.head_sha = '0'.repeat(40);}],
  ['native/native-suite-status.json', row => {row.componentEvidence = 1;}],
  ['native/device-restoration.json', row => {row.verified = false;}],
]) test('rejects an incomplete or mismatched full gate: ' + file + ' ' + mutate.toString().slice(0, 45), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-review-gate-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, temp, {recursive: true}); const path = resolve(temp, file), row = JSON.parse(readFileSync(path)); mutate(row);
  writeFileSync(path, JSON.stringify(row)); assert.throws(() => assertContextReplayGate(temp));
});
test('altering an original session capture invalidates the bundle', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-review-replay-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, resolve(temp, contextReplayFolder), {recursive: true});
  writeFileSync(resolve(temp, contextReplayFolder, 'captures/08-parent-later-trip-and-legacy.jpg'), 'changed');
  assert.throws(() => validateContextReplayEvidence(temp), /08-parent-later-trip-and-legacy.jpg/);
});
