import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export function validateRejectedCaptureCi(base) {
  const read = file => readFileSync(resolve(base, 'current-ci', file), 'utf8'), json = file => JSON.parse(read(file));
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 124066142558); assert.equal(job.run_id, 41056764259);
  assert.equal(job.head_sha, '1cc8f12e19db286491f1ec6dfff76be0ba836946');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(artifact.id, 12978553187); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, job.head_sha);
  const parsed = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')), stored = json('ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(stored[key], value);
  assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [253, 199, 54, 0]);
  const team = parsed.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.TeamConversationFlowTest');
  assert.equal(team.length, 3); assert(team.every(row => row.status === 'passed'));
  assert.deepEqual(json('native-suite-status.json'),
    {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 1, localReplay: 1});
  const transfer = json('adb-host-component-transfer.json');
  assert.equal(transfer.scope, 'sanitized-host-transport-observations-not-root-cause-or-flow-proof');
  assert.equal(transfer.phase, 'component-transfer'); assert.equal(transfer.emulatorStates.offline, 1);
  assert.equal(transfer.retryPerformed, false); assert.equal(transfer.deviceMutationRequested, false);
  const network = json('local-chat-network-ui.json'); assert.equal(network.completed, false);
  assert.equal(network.projectId, 'demo-sgm-local-qa'); assert.equal(network.runId, '6fec7fb47e3457b06143b680e0c84aad');
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  for (const key of ['initialNetwork', 'preparation', 'preparationFailure']) {
    const state = network[key]; assert.equal(state.backendReachable, true); assert.equal(state.hasDefaultDataSubscription, false);
    assert.equal(state.cellularDataState, 0); assert.deepEqual(state.internetTransports, ['wifi']);
    assert.equal(state.capabilityObservation.active.validated, true);
  }
  assert.equal(network.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  for (const phase of ['before', 'after']) {
    const history = json('chat-network-validation-' + phase + '.json'); assert.equal(history.runId, network.runId);
    assert.equal(history.newProbesIssued, false); assert.equal(history.rawLogsRetained, false); assert.equal(history.flowCompleted, false);
    assert.equal(history.groupCount, 1); assert.deepEqual(history.groups[0].transports, ['wifi']);
    assert(history.groups[0].events.every(event => event.result === 'success' || event.httpStatus === 204));
  }
  assert.match(read('LocalChatNetworkFlowTest-instrumentation.txt'), /Condition still not satisfied after 30000 ms/);
  assert.match(read('LocalChatNetworkFlowTest-instrumentation.txt'), /LocalChatNetworkFlowTest\.kt:82/);
  return {ordinaryPassed: 199, fullGatePassed: false, failedPhase: 'network-preparation'};
}
