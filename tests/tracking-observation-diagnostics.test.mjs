import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {parseRideObservationTrace, verifyDisconnectedRideTrace} from '../scripts/qa/ride-observation-trace-evidence.mjs';
import {validateTrackingDiagnosticScope, validateTrackingObservationDiagnostics} from '../scripts/qa/tracking-observation-diagnostics.mjs';
import {content} from '../partner-portal/content.mjs';
const directory = 'docs/release/evidence/tracking-observation-diagnostics-2026-10-25';
const record = {source: directory + '/summary.json', checksums: directory + '/artifact-sha256.json', checkedAt: '2026-10-25'};
const views = readdirSync(directory).filter(name => /^second-.*events\.txt$/.test(name))
  .map(name => readFileSync(directory + '/' + name, 'utf8'));
const rows = parseRideObservationTrace(views);
test('all original views reconstruct two complete disconnected listeners with four completed refreshes', () => {
  assert.equal(rows.length, 20);
  assert.deepEqual(verifyDisconnectedRideTrace(rows), {completedRefreshes: 4, listenerLifetimesMs: [470107, 135537],
    databaseConnectionEstablished: false, locationInvalidationsObserved: 0});
});
test('visible log fragments cannot prove absence of later events', () => {
  assert.throws(() => verifyDisconnectedRideTrace(parseRideObservationTrace([views[0]])));
  assert.throws(() => verifyDisconnectedRideTrace(rows.filter(row => row.observer !== 1 || row.sequence !== 9)));
});
test('overlapping views cannot disagree or accept payload strings', () => {
  assert.throws(() => parseRideObservationTrace([...views, views[0].replace('event=Opened', 'event=Opened token=secret')]));
  assert.throws(() => parseRideObservationTrace([...views, views[0].replace('connected=false', 'connected=true')]));
});
for (const mutation of ['connected', 'location', 'unfinished', 'slow']) test('contradictory trace is rejected: ' + mutation, () => {
  const changed = structuredClone(rows);
  if (mutation === 'connected') changed.find(row => row.event === 'Connected').connected = true;
  if (mutation === 'location') changed.find(row => row.event === 'RideCached').event = 'LocationChanged';
  if (mutation === 'unfinished') changed.find(row => row.event === 'FetchCompleted').event = 'RideCached';
  if (mutation === 'slow') changed.find(row => row.event === 'FetchCompleted').elapsedMs += 10_000;
  assert.throws(() => verifyDisconnectedRideTrace(changed));
});
test('retained negative runs, supplemental isolation, units and failed CI are validated without release acceptance', () => {
  const result = validateTrackingObservationDiagnostics(process.cwd(), record);
  assert.equal(result.ci.mainAccepted, false);
  assert.deepEqual(content.flows.find(row => row.id === 'tracking-network').trackingNetworkDiagnostics, record);
  assert.equal(content.blockers.find(row => row.id === 'native-evidence-copy').source, directory + '/README.md');
});
for (const key of ['tracingEnabledInRelease', 'firstAttemptCompleted', 'secondNetworkCheckpointRunCompleted',
  'offlineBoundaryAccepted', 'overallFlowAccepted', 'transportRootCauseConfirmed', 'productionWrites', 'releaseScenariosAccepted'])
  test('diagnostics cannot promote incomplete scope: ' + key, () => {
    const report = JSON.parse(readFileSync(record.source));
    assert.throws(() => validateTrackingDiagnosticScope({...report, [key]: true}));
  });
