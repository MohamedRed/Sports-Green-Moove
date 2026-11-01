import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {assertInstrumentationPassed} from '../scripts/qa/android-instrumentation-result.mjs';

export const signOutConnectedFolder = 'docs/release/evidence/native-team-push-signout-connected-a2e3e19-2026-11-01/';
export function validateSignOutConnected(root, folder = signOutConnectedFolder) {
  const base = resolve(root, folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(base);
  const run = json('review.json'), artifact = json('artifact.json'), job = json('job.json'), connected = json('connected.json'), device = json('device.json');
  assert.equal(run.scope, 'virtual-native-signout-with-synthetic-registration-only');
  assert.equal(run.sourceCommit, 'a2e3e19e3db59fdcb870fb92ca0a1d7438a814f2');
  assert.equal(run.testedAt, connected.testedAt); assert.equal(run.testedAt.slice(0, 10), '2026-11-01');
  assert.equal(run.jobId, 124904989251); assert.equal(job.id, run.jobId); assert.equal(job.run_id, 41325676113);
  assert.equal(job.head_sha, run.sourceCommit); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 13091247720); assert.equal(artifact.workflow_run.id, job.run_id); assert.equal(artifact.workflow_run.head_sha, run.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + run.archiveSha256); assert.equal(artifact.expired, false);
  for (const key of ['nativeUiExecuted', 'authenticatedSyntheticRemovalVerified', 'sourceHashesMatchedTestedCommit', 'rawArchiveDigestIndependentlyMatched'])
    assert.equal(run[key], true, key);
  for (const key of ['realPhoneTokenRegistered', 'pushDeliveryVerified', 'tapNavigationVerified', 'physicalDevice', 'productionWrites', 'releaseAccepted'])
    assert.equal(run[key], false, key);
  assert.equal(run.realMessagingSdkCalls, 0); assert.deepEqual(run.publishedCaptures, {});
  assert.equal(run.runId, '283998597b0527cf617bc4b82b346659'); assert.equal(connected.runId, run.runId);
  assert.equal(connected.projectId, 'demo-sgm-local-qa'); assert.equal(connected.nativeUiExecuted, true); assert.equal(connected.testCount, 1);
  assert.deepEqual(device, connected.phoneSignOut); assert.equal(device.runId, run.runId); assert.equal(device.projectId, connected.projectId);
  assert.equal(device.scope, 'isolated-native-ui-signout-with-synthetic-phone-token');
  assert.equal(device.activationRevision, 2); assert.equal(device.removalRevision, 3); assert.match(device.installationHash, /^[a-f0-9]{64}$/);
  for (const key of ['confirmedWhileAuthenticated', 'authAbsentAfter', 'uiLoginReturned', 'durableSignOutIntent']) assert.equal(device[key], true, key);
  assert.equal(device.syntheticTokenCalls, 1); assert.equal(device.realMessagingSdkCalls, 0); assert.equal(device.pushDeliveryVerified, false);
  assert.deepEqual(connected.phoneSignOutRecords, {scope: 'independent-local-removal-state-not-real-token-delivery',
    finalRemovalIndependentlyRead: true, activationIndependentlyRead: false, inactiveRegistrations: 1, tokenIndexes: 0,
    realMessagingSdkCalls: 0, pushDeliveryVerified: false});
  assert.equal(connected.cleanupMode, 'destroy-owned-local-environment'); assert.equal(connected.adminClientClosed, true);
  assert.equal(connected.localPackagesRemoved, true); assert.equal(connected.physicalDevice, false); assert.equal(connected.productionWrites, false);
  assert.equal(connected.checks.length, 9); assert(connected.checks.every(row => row.status === 'passed'));
  assert.deepEqual(run.sourceFiles, connected.sourceFiles); assertRetainedSourceFiles(root, run.sourceFiles);
  const transcript = bytes('instrumentation.txt').toString(); assertInstrumentationPassed(transcript, 1);
  assert(transcript.includes('INSTRUMENTATION_STATUS: sgm_installations_blocked=true'));
  assert(transcript.includes('be.sportgreenmoove.app.ui.LocalTeamConversationFlowTest:.'));
  assert.equal(transcript.split('\n').filter(line => line.startsWith('OK (')).length, 1);
  assert.equal(createHash('sha256').update(bytes('instrumentation.txt')).digest('hex'), connected.transcriptSha256);
  assert.equal(json('suite-status.json').status, 0);
  const copy = json('copy.json'); assert.equal(copy.runId, run.runId); assert.equal(copy.phase, 'team-conversation'); assert.equal(copy.completed, true);
  const restore = json('restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  for (const [file, record] of Object.entries(run.archiveEntries)) {
    assert(record.entry.startsWith('local-ui-evidence/' + run.runId + '/') || record.entry.startsWith('focused-safety-ui/team-conversation/'));
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), record.sha256);
  }
  assert.equal(Object.keys(run.archiveEntries).length, 6);
  return run;
}
