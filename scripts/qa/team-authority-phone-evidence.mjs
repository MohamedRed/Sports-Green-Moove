import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { teamAuthorityPhases, verifyTeamAuthorityCheckpoint } from './manual-team-authority-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';

export const teamAuthorityPhoneScope = 'physical-android-team-guardian-revocation-and-new-admission';
export function validateTeamAuthorityPhone(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = name => readFile(resolve(base, name));
  const json = name => JSON.parse(read(name)), run = json(basename(source));
  assert.equal(run.scope, teamAuthorityPhoneScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, 'a14a89072818f1eaa17900a95a6f96ec');
  assert.equal(run.appSourceCommit, '458318c3d7e64252d39c9458dd94cf04a06df79a');
  assert.equal(run.appSha256, '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44');
  assert.deepEqual(run.device, {model: 'Google Pixel 9', os: 'Android 15'});
  assert.equal(run.captureMethod, 'reviewed-browser-stream-context-with-declared-device-rectangle');
  assert.deepEqual(run.captureRectangle, {left: 626, top: 110, width: 250, height: 558});
  for (const key of ['physicalDevice', 'manualNativeUiObserved', 'guardianAccessChangesVerified', 'singleExplicitParentSend'])
    assert.equal(run[key], true, key);
  for (const key of ['managerUiProven', 'twoPhoneFlowVerified', 'notificationsVerified', 'trackingVerified',
    'paymentExercised', 'productionWrites', 'releaseEvidenceAccepted', 'fullCiVerified', 'nativePngExportObtained', 'videoCaptured'])
    assert.equal(run[key], false, key);
  const session = json('session-results.json');
  assert.equal(session.scope, 'independent-team-authority-records-not-phone-ui-proof');
  assert.equal(session.completed, true); assert.equal(session.adminClientClosed, true);
  assert.equal(session.runId, run.runId); assert.equal(session.projectId, run.projectId); assert.equal(session.testedAt, run.testedAt);
  assert.deepEqual(session.actions, ['revoke', 'renew', 'publish']); assert.equal(session.checkpoints.length, 5);
  for (const key of ['phoneUiProven', 'managerUiProven', 'twoPhoneFlowVerified', 'notificationsVerified',
    'productionWrites', 'fixtureEnvironmentDestroyed', 'releaseEvidenceAccepted']) assert.equal(session[key], false, key);
  const identity = json('replied.json').identity;
  assert.equal(identity.parentUid, 'sgm-qa-parent'); assert.equal(identity.driverUid, 'sgm-qa-driver');
  let previous = 0;
  for (const [index, phase] of teamAuthorityPhases.entries()) {
    const row = json(phase + '.json'); assert.equal(row.runId, run.runId); assert.equal(row.projectId, run.projectId);
    assert.equal(row.phoneUiProven, false);
    for (const [key, value] of Object.entries(row.identity)) assert.equal(value, identity[key]);
    const result = verifyTeamAuthorityCheckpoint(phase, row.state, identity);
    assert.deepEqual(row.result, result); assert.deepEqual(session.checkpoints[index], result);
    for (const key of ['protectedBaselinePreserved', 'originalClaimsUnchanged', 'expectedProfileTimestampUpdatesOnly'])
      assert.equal(row.isolation[key], true, key);
    assert.equal(row.isolation.protectedRecordCount, 158);
    const time = Date.parse(row.recordedAt); assert(time > previous && time <= Date.parse(run.testedAt)); previous = time;
    assert(Date.parse(run.captureSaveTimes[phase]) <= time);
  }
  assert.deepEqual(run.publishedCaptures, Object.fromEntries(teamAuthorityPhases.map(id => ['team-authority-phone-' + id, id + '-device.jpg'])));
  const connection = json('connection-policy.json'); assertIsolatedTunnelSettings(connection.settings);
  assert.equal(connection.phoneToolbarActiveObserved, true); assert.equal(connection.forceLocalUncheckedObserved, true);
  assert.equal(connection.credentialValuesRetained, false);
  const cleanup = json('local-cleanup.json'); assert(Date.parse(cleanup.verifiedAt) >= Date.parse(run.testedAt));
  for (const key of ['privateSessionRemoved', 'privateHandoffRemoved', 'ownedRuntimeRemoved', 'ownedProcessesAbsent'])
    assert.equal(cleanup[key], true, key);
  assert.deepEqual(cleanup.loopbackPortsRefused, [5001, 8080, 9000, 9099]); assert.equal(cleanup.devicePolicyChanged, false);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130); assert.equal(cleanup.controllerExitCode, 0);
  assert.equal(cleanup.packageInventoryIndependentlyRead, false);
  assert.match(read('uninstalled-ui.txt').toString(), /Succesfully uninstalled your app\(s\)!/);
  const closed = read('closed-ui.txt').toString(); assert.match(closed, /Title: "App Live Dashboard"/);
  assert.match(closed, /Uploaded Apps/); assert.doesNotMatch(closed, /button Description: Stop Session/);
  const hashes = json('artifact-sha256.json');
  for (const file of ['results.json', 'session-results.json', 'local-cleanup.json', 'connection-policy.json', 'uninstalled-ui.txt',
    'closed-ui.txt', ...teamAuthorityPhases.flatMap(id => [id + '.json', id + '-context.jpg', id + '-device.jpg'])])
    assert(Object.hasOwn(hashes, file), file);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  for (const file of Object.values(run.publishedCaptures)) assert.equal(read(file).subarray(0, 2).toString('hex'), 'ffd8');
  assertRetainedSourceFiles(root, session.sourceFiles); return run;
}
