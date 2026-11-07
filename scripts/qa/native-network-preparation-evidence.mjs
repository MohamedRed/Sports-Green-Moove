import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeNetworkPreparation(root, record) {
  const base = dirname(resolve(root, record.source));
  assert.equal(record.checkedAt, '2026-10-23');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const run = JSON.parse(readFileSync(resolve(base, 'run.json')));
  assert.equal(run.headSha, '80c88d0c33b388fcd4d9306137146172c17fe5b8');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39952433007');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const log = readFileSync(resolve(base, 'failure-excerpt.txt'), 'utf8');
  assert.match(log, /LocalChatNetworkFlowTest.kt:82/); assert.match(log, /ComposeTimeoutException/);
  const json = file => JSON.parse(readFileSync(resolve(base, 'diagnostics', file)));
  const network = json('local-chat-network-ui.json');
  assert.equal(network.projectId, 'demo-sgm-local-qa'); assert.equal(network.runId, '333c2318d2f3870aff114b011a289a99');
  assert.equal(network.completed, false); assert.equal(network.failedPhase, 'network-preparation');
  assert.deepEqual(network.network, []); assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  for (const sample of [network.initialNetwork, network.preparation, network.preparationFailure]) {
    assert.equal(sample.backendReachable, true); assert.equal(sample.hasDefaultDataSubscription, false);
    assert.equal(sample.cellularAvailableCallbacks, 0); assert.equal(sample.cellularDataState, 0);
    assert.deepEqual(sample.internetTransports, ['wifi']); assert.deepEqual(sample.activeInternetTransports, ['wifi']);
  }
  for (const phase of ['before', 'after']) {
    const subscriptions = json(`chat-subscriptions-${phase}.json`), history = json(`chat-default-selection-${phase}.json`);
    const carrier = json(`chat-carrier-${phase}.json`), modem = json(`chat-modem-${phase}.json`);
    for (const row of [subscriptions, history, carrier, modem]) {
      assert.equal(row.runId, network.runId); assert.equal(row.projectId, network.projectId); assert.equal(row.phase, phase);
    }
    assert.equal(subscriptions.allSubscriptionsLoaded, true); assert.deepEqual(subscriptions.simStates, ['LOADED']);
    assert.equal(subscriptions.defaultSubscriptionValid.defaultDataSubId, false);
    assert.equal(subscriptions.defaultSubscriptionValid.activeDataSubId, false);
    assert.equal(history.recognizedEventCount, 0); assert.equal(history.lastReadiness, null);
    assert.deepEqual(carrier.configChangeSent, [true]); assert.equal(modem.voice, 'home'); assert.equal(modem.data, 'home');
  }
  const cleanup = json('disposable-store-restore.json'), host = json('host-shutdown.json');
  assert.equal(cleanup.verified, true); assert.equal(cleanup.restored, true);
  assert.equal(cleanup.restoration.localPackagesRemoved, true); assert.equal(cleanup.restoration.launcher, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(cleanup.restoration.installAdmin[key], true);
  assert.equal(host.finalState, 'zombie'); assert.equal(host.targetExitObserved, false);
  assert.equal(host.flowAccepted, false); assert.equal(host.rootCauseConfirmed, false);
  assertEvidenceBundleChecksums(base); return run;
}
