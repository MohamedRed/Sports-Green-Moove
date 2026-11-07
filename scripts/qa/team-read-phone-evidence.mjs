import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { teamReadPhonePhases, verifyTeamReadPhoneCheckpoint } from './manual-team-read-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';

export const teamReadPhoneScope = 'physical-android-team-unread-with-isolated-services';
export function validateTeamReadPhone(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = name => readFile(resolve(base, name));
  const json = name => JSON.parse(read(name)), run = json(basename(source));
  assert.equal(run.scope, teamReadPhoneScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.runId, '59d574153c71057d48777f57fe502944');
  assert.equal(run.sourceCommit, '458318c3d7e64252d39c9458dd94cf04a06df79a');
  assert.equal(run.appSha256, '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44');
  assert.deepEqual(run.device, { model: 'Google Pixel 9', os: 'Android 15' });
  assert.equal(run.captureMethod, 'reviewed-browser-stream-context-with-declared-device-rectangle');
  assert.deepEqual(run.captureRectangle, { left: 626, top: 110, width: 250, height: 558 });
  assert.deepEqual(run.accountsInOrder, ['sgm-qa-parent', 'sgm-qa-driver', 'sgm-qa-parent']);
  for (const key of ['physicalDevice', 'manualNativeUiObserved', 'unreadStateVerified', 'singleExplicitParentSend']) assert.equal(run[key], true, key);
  for (const key of ['nativePngExportObtained', 'videoCaptured', 'twoPhoneFlowVerified', 'notificationsVerified',
    'trackingVerified', 'paymentExercised', 'productionWrites', 'releaseEvidenceAccepted', 'fullCiVerified']) assert.equal(run[key], false, key);
  const session = json('session-results.json'); assert.equal(session.completed, true);
  assert.equal(session.scope, 'manual-team-read-record-checkpoints-not-ui-or-release-proof');
  assert.equal(session.runId, run.runId); assert.equal(session.projectId, run.projectId); assert.equal(session.testedAt, run.testedAt);
  assert.equal(session.checkpoints.length, 8); assert.equal(session.adminClientClosed, true);
  for (const key of ['physicalUiProvenByThisReport', 'notificationsVerified', 'productionWrites', 'fixtureEnvironmentDestroyed'])
    assert.equal(session[key], false, key);
  const last = json('parent-returned.json').state;
  const fixture = { parent: { uid: 'sgm-qa-parent' }, driver: { uid: 'sgm-qa-driver' },
    otherParent: { uid: 'sgm-qa-chat-other-parent' }, target: { teamId: 'zz-sgm-qa-chat-team',
      expectedTeamInstanceId: last.pages['sgm-qa-parent'].teamInstanceId }, earlyMessageId: last.entries[0].id,
    initialMessageId: last.entries[1].id, newMessageId: last.entries[2].id };
  let previous = 0;
  for (const [index, phase] of teamReadPhonePhases.entries()) {
    const row = json(phase + '.json'); assert.equal(row.runId, run.runId); assert.equal(row.projectId, run.projectId);
    assert.equal(row.scope, 'independent-isolated-team-read-records-not-phone-ui-proof');
    assert.equal(row.phoneUiProven, false); assert.equal(row.controllerMarksReads, false);
    const result = verifyTeamReadPhoneCheckpoint(phase, row.state, fixture);
    assert.deepEqual(row.result, result); assert.deepEqual(session.checkpoints[index], result);
    for (const key of ['protectedBaselinePreserved', 'originalClaimsUnchanged', 'expectedProfileTimestampUpdatesOnly']) assert.equal(row.isolation[key], true);
    assert.equal(row.isolation.protectedRecordCount, 158);
    const time = Date.parse(row.recordedAt); assert(time > previous && time <= Date.parse(run.testedAt)); previous = time;
    assert(Date.parse(run.captureSaveTimes[phase]) <= time);
  }
  assert.deepEqual(run.publishedCaptures, Object.fromEntries(teamReadPhonePhases.map(id => ['team-read-phone-' + id, id + '-device.jpg'])));
  const connection = json('connection-policy.json'); assertIsolatedTunnelSettings(connection.settings);
  assert.equal(connection.phoneToolbarActiveObserved, true); assert.equal(connection.forceLocalUncheckedObserved, true);
  assert.equal(connection.privateCredentialTransport, 'owner-only-named-pipes');
  const cleanup = json('local-cleanup.json'); assert(Date.parse(cleanup.verifiedAt) >= Date.parse(run.testedAt));
  for (const key of ['privateSessionRemoved', 'privateHandoffRemoved', 'ownedRuntimeRemoved', 'ownedProcessesAbsent']) assert.equal(cleanup[key], true);
  assert.deepEqual(cleanup.loopbackPortsRefused, [5001, 8080, 9000, 9099]);
  assert.equal(cleanup.devicePolicyChanged, false); assert.equal(cleanup.initialRuntimeCleanupExitCode, 1);
  assert.equal(cleanup.remainingCliConfigRemovedAfterProcessExit, true);
  assert.match(read('uninstall-ui.txt').toString(), /Succesfully uninstalled your app\(s\)!/);
  const closed = read('closed-ui.txt').toString(); assert.match(closed, /Title: "App Live Dashboard"/);
  assert.match(closed, /Uploaded Apps/); assert.doesNotMatch(closed, /button Description: Stop Session/);
  const hashes = json('artifact-sha256.json');
  for (const file of ['results.json', 'session-results.json', 'connection-policy.json', 'local-cleanup.json', 'uninstall-ui.txt',
    'closed-ui.txt', 'closed-context.jpg', ...teamReadPhonePhases.flatMap(id => [id + '.json', id + '-context.jpg', id + '-device.jpg'])])
    assert(Object.hasOwn(hashes, file), file);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  for (const file of Object.values(run.publishedCaptures)) assert.equal(read(file).subarray(0, 2).toString('hex'), 'ffd8');
  assertRetainedSourceFiles(root, session.sourceFiles); return run;
}
