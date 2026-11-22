import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseRideObservationTrace, verifyDisconnectedRideTrace} from './ride-observation-trace-evidence.mjs';
import {assertTrackingPhoneState} from './tracking-phone-state.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export function validateTrackingDiagnosticScope(summary) {
  assert.equal(summary.scope, 'isolated-physical-phone-live-observation-diagnostics-not-release-proof');
  assert.equal(summary.diagnosticBuildOnly, true); assert.equal(summary.traceSequencesComplete, true);
  assert.equal(summary.supplementalSignedOutStabilityObserved, true); assert.equal(summary.routeProviderRequests, 0);
  assert.deepEqual(summary.publicMedia, []);
  for (const key of ['productionBehaviorChanged', 'tracingEnabledInRelease', 'databaseConnectionEstablished',
    'firstAttemptCompleted', 'secondNetworkCheckpointRunCompleted', 'offlineBoundaryAccepted', 'continuousDisplayProven',
    'overallFlowAccepted', 'transportRootCauseConfirmed', 'productionWrites', 'realMovementProven', 'parentPhoneProven',
    'childTrackingProven', 'releaseScenariosAccepted']) assert.equal(summary[key], false, key);
}

export function validateTrackingObservationDiagnostics(root, record) {
  const base = resolve(root, dirname(record.source)); assertEvidenceBundleChecksums(base);
  assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  const read = name => readFileSync(resolve(base, name), 'utf8'), json = name => JSON.parse(read(name));
  const summary = json('summary.json'); validateTrackingDiagnosticScope(summary); assert.equal(summary.testedAt, record.checkedAt);
  const files = readdirSync(base).filter(name => /^second-.*events\.txt$/.test(name));
  const trace = verifyDisconnectedRideTrace(parseRideObservationTrace(files.map(read)));
  for (const [key, value] of Object.entries(trace)) assert.deepEqual(summary[key], value);
  for (const [directory, count] of [['observer', 2], ['observer2', 3]]) {
    const run = json(directory + '/session-results.json');
    assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.completed, false); assert.equal(run.checkpoints.length, count);
    assert(run.adminClientClosed && run.firestoreClientTerminated);
  }
  const initial = json('observer2/baseline.json');
  let previous;
  for (const name of ['after-network-restoration', 'signed-out', 'signed-out-stable']) {
    const sample = json(name + '.json'); assert.equal(sample.runId, initial.runId);
    assert.equal(sample.allOtherRecordsUnchanged, true);
    const checked = assertTrackingPhoneState(sample.state, initial.baseline, initial.fixture,
      {active: true, point: {lat: 50.7177, lng: 4.6177}, ...(name === 'signed-out-stable' ? {stable: true, previous} : {})});
    assert.deepEqual(sample.checked, checked);
    if (name === 'signed-out-stable') assert(sample.observedForMs >= 50_000);
    previous = sample.state;
  }
  const apk = json('apk-source.json'); assert.equal(apk.uncommittedDiagnostic, true);
  for (const [file, expected] of Object.entries(apk.sources))
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'source', file))).digest('hex'), expected);
  const parser = new XMLParser({ignoreAttributes: false}), totals = {suites: 0, tests: 0, failures: 0, errors: 0, skipped: 0};
  for (const name of readdirSync(resolve(base, 'unit'))) {
    const suite = parser.parse(read('unit/' + name)).testsuite; totals.suites++;
    for (const key of ['tests', 'failures', 'errors', 'skipped']) totals[key] += Number(suite['@_' + key]);
  }
  assert.deepEqual(totals, json('unit-summary.json')); assert.equal(totals.tests, 567);
  assert.equal(totals.failures + totals.errors + totals.skipped, 0);
  const run = json('ci-run.json'); assert.equal(run.headSha, summary.ci.headSha);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') &&
    row.name !== 'Android focused safety UI tests / Isolated safety flows');
  assert.equal(focused.length, 10); assert(focused.every(row => row.conclusion === 'success'));
  const ordinary = parseAndroidJUnitTranscript(read('ci/ordinary-instrumentation.txt'));
  for (const key of ['cases', 'caseCount', 'passed', 'skipped', 'failed']) assert.deepEqual(json('ci/ordinary-results.json')[key], ordinary[key]);
  assert.equal(ordinary.failed, 1); assert.equal(ordinary.passed, 165); assert.equal(ordinary.skipped, 54);
  assert(read('ci/ordinary-instrumentation.txt').includes('java.lang.AssertionError: Failed waiting for PixelCopy!'));
  assert.equal(json('ci/adb-pull-trip-consent-recovery.json').completed, false);
  assert.equal(json('ci/disposable-store-restore.json').verified, true); assert.equal(json('ci/host-shutdown.json').targetExitObserved, true);
  assert.equal(summary.ci.mainAccepted, false); assert.equal(summary.ci.rootCauseConfirmed, false);
  const cleanup = json('cleanup.json');
  for (const key of ['phoneSessionsStopped', 'uninstallAcknowledgements', 'networkSimulationRestored', 'helperGroupStopped',
    'helperHandoffRemoved', 'privateSessionsRemoved', 'ownedRuntimeRemoved', 'endpointsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.packageAbsenceProven, false);
  assert.match(read('second-network-restored.txt'), /text Turn off network simulation/);
  assert.match(read('second-uninstall.txt'), /Succesfully uninstalled your app/);
  assert.match(read('second-session-stopped.txt'), /App Live Dashboard/);
  return summary;
}
