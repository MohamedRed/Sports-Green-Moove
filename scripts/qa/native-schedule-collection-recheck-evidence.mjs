import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';

export function validateNativeScheduleCollectionRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), read = file => readFileSync(resolve(base, file), 'utf8');
  assert.equal(record.checkedAt, '2026-10-23');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const json = file => JSON.parse(read(file)), run = json('run.json');
  assert.equal(run.headSha, '7c7bb699dfd59b5a66ef1a7656296da26c9bdddc');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39966044757');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(run.jobs.find(job => job.databaseId === 120456057466).conclusion, 'failure');
  assert.match(read('failure-excerpt.txt'), /EvidenceCollectionError:.*trip-change-schedule; status=1/);
  assertInstrumentationPassed(read('diagnostics/LocalRideFlowTest-instrumentation.txt'), 1);
  const failed = json('diagnostics/adb-pull-trip-change-schedule.json'), cleanup = json('diagnostics/adb-pull-failure-cleanup.json');
  assert.equal(failed.runId, '5e76f69f0767309cd85c696949b0fc43'); assert.equal(failed.completed, false);
  assert.equal(failed.status, 1); assert.equal(failed.signal, null); assert.equal(failed.errorCode, null);
  assert.equal(cleanup.runId, failed.runId); assert.equal(cleanup.completed, true); assert.match(cleanup.stderr, /95 files pulled/);
  const sync = json('diagnostics/adb-sync-trip-change-schedule-diagnostics.json');
  assert(sync.observations.some(row => row.stderr?.includes('device offline')));
  const restoration = json('diagnostics/disposable-store-restore.json'), host = json('diagnostics/host-shutdown.json');
  assert.equal(restoration.verified, true); assert.equal(restoration.restoration.localPackagesRemoved, true);
  assert.equal(restoration.restoration.launcher, true); assert.equal(host.finalState, 'gone'); assert.equal(host.targetExitObserved, true);
  const bootstrap = json('network-bootstrap/complete.json'), history = json('network-bootstrap/chat-default-selection-before.json');
  assert.equal(bootstrap.completed, true); assert.equal(bootstrap.testAppsAbsent, true);
  assert.equal(bootstrap.radioOrLoggingSettingsChanged, false); assert.equal(bootstrap.flowCompleted, false);
  assert.equal(bootstrap.runId, 'fffb0f4ebd19b05954855a7f2034a819'); assert.equal(history.runId, bootstrap.runId);
  assert.equal(history.recognizedEventCount, 3);
  assert.deepEqual(history.lastReadiness, { type: 'readiness', subscriptionsInitialized: true,
    carrierConfigurationsLoaded: false, satelliteEnabledOrEnabling: false });
  const subscriptions = json('network-bootstrap/chat-subscriptions-before.json');
  assert.deepEqual(subscriptions.simStates, ['READY']); assert.equal(subscriptions.defaultSubscriptionValid.defaultDataSubId, false);
  assert.equal(subscriptions.defaultSubscriptionValid.activeDataSubId, false);
  assert(Object.values(json('network-bootstrap/log-emission-properties.json').properties).every(value => value === null));
  assertEvidenceBundleChecksums(base); return run;
}
