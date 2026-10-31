import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';
import {validateTeamChatNativeDevice} from './team-chat-native-evidence.mjs';

export const nativeFollowup = Object.freeze({folder: 'docs/release/evidence/native-followup-9bb6346-2026-10-30/',
  head: '9bb6346687a36504129a6b2cceb50c5b7fe595e0', workflowId: 41052223049, date: '2026-10-30',
  team: {runId: '12e97046573bd459f2edf89bae8d312d', jobId: 124050828375, artifactId: 12975941169},
  network: {runId: 'e557d3152883d7d150112c72049f447f', jobId: 124050828686, artifactId: 12975033378}});

export function validateNativeFollowup(root, reference = {source: nativeFollowup.folder + 'team/team-conversation-results.json',
  checkedAt: nativeFollowup.date, checksums: nativeFollowup.folder + 'team/artifact-sha256.json'}) {
  const identity = nativeFollowup, base = resolve(root, identity.folder);
  assert.deepEqual(reference, {source: identity.folder + 'team/team-conversation-results.json', checkedAt: identity.date,
    checksums: identity.folder + 'team/artifact-sha256.json'});
  const read = file => readFileSync(resolve(base, file)), json = file => JSON.parse(read(file));
  const expected = {...identity, ...identity.network, folder: identity.folder + 'network/'};
  const network = validateChatNetworkRecheck(root,
    {source: expected.folder + 'chat-network-recovery-results.json', checkedAt: identity.date}, expected);
  assert(network.sourceFiles['scripts/qa/local-network-validation-diagnostics.mjs']);
  for (const phase of ['before', 'after']) {
    const history = json('network/chat-network-validation-' + phase + '.json');
    assert.equal(history.runId, identity.network.runId); assert.equal(history.projectId, 'demo-sgm-local-qa');
    assert.equal(history.phase, phase); assert.equal(history.schemaVersion, 1);
    assert.equal(history.scope, 'read-only-disposable-network-validation-history');
    assert.equal(history.source, 'bounded-android-validation-history-not-current-capabilities-or-selection-reason');
    for (const key of ['atomicObservation', 'identifiersRetained', 'addressesRetained', 'probeTargetsRetained',
      'rawLogsRetained', 'newProbesIssued', 'flowCompleted']) assert.equal(history[key], false, key);
    assert.equal(history.groupCount, history.groups.length); assert(history.groupCount > 0);
    for (const group of history.groups) {
      assert.equal(group.eventsTruncated, false); assert.equal(group.unrecognizedProbeLineCount, 0);
      assert.equal(group.events.length, group.probeLineCount);
    }
  }
  const teamBase = resolve(base, 'team'); assertEvidenceBundleChecksums(teamBase);
  const team = json('team/team-conversation-results.json'), marker = json('team/team-conversation-device.json');
  validateTeamChatNativeDevice(marker, json('team/adb-pull-team-conversation.json'), identity.team.runId,
    file => read('team/' + file));
  assert.equal(team.runId, marker.runId); assert.equal(team.scope, marker.scope);
  assert.equal(team.testedAt.slice(0, 10), identity.date); assert.equal(team.testCount, 1); assert.equal(team.nativeCaseCount, 1);
  assert.deepEqual(team.checks, marker.checks); assert.deepEqual(team.screenshots, marker.screenshots);
  assert.deepEqual(team.steps, [{id: 'team-conversation-connected-native-ui', status: 'passed'}]);
  const {isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app} = team;
  assert.deepEqual(json('team/team-conversation-app-results.json'), app);
  for (const key of ['nativeUiExecuted', 'adminClientClosed', 'localPackagesRemoved', 'unreadStateVerified',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(team[key], true, key);
  for (const key of ['productionWrites', 'physicalDevice', 'notificationsVerified', 'fullProcessRestartProven',
    'externalSdkTrafficVerified']) assert.equal(team[key], false, key);
  assert.equal(team.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert.deepEqual(team.fixtureIsolation, {protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158, committedMessages: 5, messageOperations: 5,
    noDraftPersisted: true, parentRevocationPersisted: true, otherVerifiedParentRetainsAccess: true,
    driverAndChildEnrollmentUnchanged: true});
  const transcript = read('team/LocalTeamConversationFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1);
  assert.equal(createHash('sha256').update(transcript).digest('hex'), team.transcriptSha256);
  assertRetainedSourceFiles(root, team.sourceFiles);
  const setup = read('team/disposable-device-setup.json'), restore = json('team/disposable-device-restore.json');
  assert.equal(team.apkPreparation.receiptSha256, createHash('sha256').update(setup).digest('hex'));
  assert.deepEqual(team.apkPreparation.apkHashes, JSON.parse(setup).apkHashes);
  assert.equal(team.apkPreparation.installationsRemainedBlocked, true);
  assert.equal(restore.case, 'team-conversation'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.deepEqual(json('team/team-conversation-suite-status.json'), {scope: 'team-conversation-command-status-not-flow-verification', status: 0});
  const job = json('team/job.json'), artifact = json('team/artifact.json');
  assert.equal(job.id, identity.team.jobId); assert.equal(job.run_id, identity.workflowId); assert.equal(job.head_sha, identity.head);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, identity.team.artifactId); assert.equal(artifact.name, 'android-focused-safety-ui-team-conversation');
  assert.equal(artifact.workflow_run.id, identity.workflowId); assert.equal(artifact.workflow_run.head_sha, identity.head);
  return {team, network};
}
