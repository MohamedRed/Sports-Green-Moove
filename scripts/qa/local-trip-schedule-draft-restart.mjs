import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedPrivateDraftTrips, snapshotPrivateDraftTrips } from './local-trip-draft-restart.mjs';
import { tripScheduleFixtureTimes } from './trip-change-schedule-evidence.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
import { assertPreparedScheduleDraft, assertScheduleDraftRestart } from './trip-schedule-draft-evidence.mjs';

const save = (directory, name, value) => writeFileSync(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

export async function replayScheduleDraftRestart({ instrument, collect, adb, serial, directory, runId }) {
  const times = tripScheduleFixtureTimes();
  const fixture = { ...await seedPrivateDraftTrips({ departureAt: times.originalDepartureAt }),
    originalDepartureAt: times.originalDepartureAt,
    draftDepartureAt: new Date(Date.parse(times.proposedDepartureAt) + 2 * 3600_000).toISOString(),
    draftArrivalBy: new Date(Date.parse(times.desiredArrivalBy) + 2 * 3600_000).toISOString() };
  const baseline = await snapshotPrivateDraftTrips(fixture);
  const args = ['-e', 'scheduleDraftTripId', fixture.tripId, '-e', 'scheduleDraftOtherTripId', fixture.otherTripId,
    '-e', 'scheduleDraftOriginalDeparture', fixture.originalDepartureAt,
    '-e', 'scheduleDraftDeparture', fixture.draftDepartureAt, '-e', 'scheduleDraftArrival', fixture.draftArrivalBy];
  instrument(['LocalTripScheduleDraftRestartTest#prepareScheduleDraft'], 1, args);
  const checkpoint = await snapshotPrivateDraftTrips(fixture);
  assert.deepEqual(checkpoint, baseline, 'A valid private schedule draft must not publish or notify parents');
  save(directory, 'trip-schedule-draft-checkpoint.json', { projectId: 'demo-sgm-local-qa', runId, ...fixture, baseline, checkpoint });
  stopDisposableAppProcess({ adb, serial, runId, outputDir: directory,
    beforeName: 'local-trip-schedule-draft-before.json', validateBefore: assertPreparedScheduleDraft });
  instrument(['LocalTripScheduleDraftRestartTest#recoverScheduleDraftInNewProcess'], 1, args);
  collect();
  const load = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const before = load('local-trip-schedule-draft-before.json'), stopped = load('local-trip-schedule-draft-stop.json');
  const after = load('local-trip-schedule-draft-after.json');
  assertScheduleDraftRestart(before, stopped, after, fixture, runId);
  const persisted = await snapshotPrivateDraftTrips(fixture);
  assert.deepEqual(persisted, baseline, 'Reopening a valid private draft must not automatically submit it');
  const captureFiles = ['local-trip-schedule-draft-before.png', 'local-trip-schedule-draft-restored.png'];
  for (const name of captureFiles) {
    const image = readFileSync(resolve(directory, name));
    assert(image.length > 24 && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  }
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    recordType: 'native-private-schedule-draft-stage-not-full-run-result', scope: 'local-ui-not-physical-device',
    nativeCaseCount: 2, ...fixture, native: { before, stopped, after }, baseline, checkpoint, persisted, captureFiles,
    recordsUnchanged: true, automaticProposalCreated: false, originalPlacesRetained: true,
    fullAppReplay: false, paymentExercised: false, routeProviderExercised: false,
    limitation: 'Valid unsubmitted date, departure time and desired arrival across a new local app process. No physical-device, iOS, route/application or payment proof.' };
  save(directory, 'trip-schedule-draft-ui-stage.json', result);
  return result;
}
