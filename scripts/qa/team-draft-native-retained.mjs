import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { basename, dirname, resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { teamDraftScope, validateTeamDraftRestart } from './team-draft-restart-evidence.mjs';

export const teamDraftStages = ['before', 'reopened', 'sent', 'cleared', 'other-account'];
export function validateRetainedTeamDraft(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = file => readFile(resolve(folder, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)), device = json('team-draft-device.json');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(run.scope, teamDraftScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, 'dff11797d92ef705427df64db10f4458'); assert.equal(run.testedAt, '2026-10-21T16:41:13.094Z');
  assert.equal(job.id, 119345801082); assert.equal(job.run_id, 39635801559);
  assert.equal(job.head_sha, 'eae253539b8db3fe01ece51f08ebb8b5d26b49c5');
  assert.equal(job.name, 'Android focused safety UI tests / Isolated team-draft');
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(artifact.id, 12363330257); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, job.head_sha); assert.equal(artifact.name, 'android-focused-safety-ui-team-draft');
  assert.equal(artifact.size_in_bytes, read('original-artifact.zip').length);
  assert.equal(artifact.digest, 'sha256:' + sha(read('original-artifact.zip')));
  assert.equal(run.nativeUiExecuted, true); assert.equal(run.nativeCaseCount, 3); assert.equal(run.testCount, 1);
  assert.deepEqual(run.steps, [{ id: 'team-draft-three-process-ui', status: 'passed' }]);
  for (const [key, value] of Object.entries(device)) assert.deepEqual(run[key], value, key);
  const before = json('local-team-draft-before.json'), sent = json('local-team-draft-sent-before.json');
  const firstStop = json('local-team-draft-stop.json'), secondStop = json('local-team-draft-sent-stop.json');
  validateTeamDraftRestart(before, firstStop, sent, secondStop, device, run.runId);
  assert.deepEqual(run.native, { firstStop, secondStop });
  const methods = ['preparePrivateTeamDraft', 'recoverAndSendPrivateDraftInNewProcess', 'acknowledgedDraftStaysEmptyInThirdProcess'];
  assert.deepEqual(Object.keys(run.transcripts).sort(), methods.map(method => `LocalTeamDraftRestartTest#${method}-instrumentation.txt`).sort());
  for (const [file, hash] of Object.entries(run.transcripts)) {
    assertInstrumentationPassed(read(file).toString(), 1); assert.equal(sha(read(file)), hash);
  }
  const unsent = json('team-draft-unsent-checkpoint.json'); assert.deepEqual(run.unsentCheckpoint, unsent);
  const baseline = { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158 };
  assert.deepEqual(unsent, { ...baseline, messageCount: 2, messageOperationCount: 2,
    unsentDraftNotSubmitted: true, exactlyOneExplicitParentSend: false });
  assert.deepEqual(run.fixtureIsolation, { ...baseline, messageCount: 3, messageOperationCount: 3,
    unsentDraftNotSubmitted: false, exactlyOneExplicitParentSend: true });
  const { isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app } = run;
  assert.deepEqual(json('team-draft-app-results.json'), app);
  assert.equal(run.cleanupMode, 'destroy-owned-local-environment');
  for (const key of ['fullProcessRestartProven', 'adminClientClosed', 'localPackagesRemoved',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(run[key], true);
  assert.deepEqual(emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  for (const key of ['productionWrites', 'physicalDevice', 'notificationsVerified']) assert.equal(run[key], false);
  assert.equal(run.safetyAuditAccepted, undefined); assert.equal(run.storeReviewAccepted, undefined);
  const pull = json('adb-pull-team-draft.json');
  assert.equal(pull.projectId, run.projectId); assert.equal(pull.runId, run.runId); assert.equal(pull.phase, 'team-draft');
  assert.equal(pull.completed, true); assert.equal(pull.status, 0); assert.equal(pull.signal, null); assert.equal(pull.errorCode, null);
  const setup = json('disposable-device-setup.json'), restore = json('disposable-device-restore.json');
  assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(setup.case, 'team-draft'); assert.equal(restore.case, setup.case);
  assert.equal(read('disposable-device-setup.json.claimed').toString(), 'team-draft\n');
  assert.equal(run.apkPreparation.method, setup.scope); assert.equal(run.apkPreparation.case, setup.case);
  assert.equal(run.apkPreparation.receiptSha256, sha(read('disposable-device-setup.json')));
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true); assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  assert.equal(restore.scope, 'single-case-device-restoration-not-flow-proof');
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  assert.deepEqual(restore.restoration, { localPackagesRemoved: true, background: true, stopped: true, launcher: true,
    installAdmin: { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true } });
  assert.equal(json('team-draft-suite-status.json').status, 0);
  assert.deepEqual(Object.keys(run.screenshots).sort(), teamDraftStages.flatMap(id => [`.png`, `-window.png`].map(suffix => `team-draft-${id}${suffix}`)).sort());
  for (const [file, hash] of Object.entries(run.screenshots)) {
    const bytes = read(file); assert.equal(sha(bytes), hash); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  const review = json('visual-review.json');
  assert.equal(review.mediaEdits, false); assert.equal(review.partialReopenedWindowRetainedOnly, true);
  assert.deepEqual(review.published, Object.fromEntries(teamDraftStages.map(id => ['team-draft-verified-' + id,
    'team-draft-' + id + (id === 'reopened' ? '.png' : '-window.png')])));
  assertRetainedSourceFiles(root, run.sourceFiles);
  assert.match(gunzipSync(read('job-log.txt.gz')).toString(), /OK \(1 test\)/);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return { ...run, publishedCaptures: review.published };
}
