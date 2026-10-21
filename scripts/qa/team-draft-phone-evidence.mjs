import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertIsolatedTunnelSettings } from './browserstack-local-policy.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamDraftPhoneScope = 'physical-android-team-draft-and-account-switch-with-isolated-services';
export const teamDraftPhoneStages = ['initial', 'unsent', 'reopened', 'sent', 'cleared', 'private-parent', 'other-account', 'returned-parent'];
const phases = ['before', 'unsent', 'reopened', 'sent', 'cleared', 'other-account'];

export function validateTeamDraftPhone(root, source, readFile = readFileSync) {
  const base = dirname(resolve(root, source)), read = file => readFile(resolve(base, file));
  const json = file => JSON.parse(read(file)), run = json(basename(source));
  assert.equal(run.scope, teamDraftPhoneScope); assert.equal(run.method, 'manual-native-ui-with-separate-authenticated-service-reads');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, 'e12f1ad1f209312e7e5c9f2fcc7637a5');
  assert.equal(run.sourceCommit, '78d6df3ed0af405b3ec1191c211f6a51582a6765');
  assert.equal(run.appSourceCommit, '70daee2173b5d75815d657dd4c4b847682aa67d7');
  assert.equal(run.appSha256, '7f78f5a0e28111501131dd58d259adc54b3ea235d7a11559b37dbd443b20a4b9');
  assert.equal(run.unchangedAppMainTree, '0d953d865f7c2b8a69fb4d2e6b275fb482fd11ab');
  assert.equal(run.unchangedBuildScriptBlob, '7eaeee8a4415792e8e9dce2b3540a138b8197137');
  assert.deepEqual(run.device, { model: 'Google Pixel 8', os: 'Android 14' });
  assert.equal(run.captureMethod, 'original-native-device-png-export');
  assert.deepEqual(run.accountsInOrder, ['sgm-qa-parent', 'sgm-qa-driver', 'sgm-qa-parent']);
  assert.equal(run.providerAppKillActions, 2);
  for (const key of ['physicalDevice', 'nativeUiVerified', 'homeObservedAfterEachKill', 'singleExplicitParentSend',
    'driverServiceReadVerified', 'driverNativeReadOnSamePhoneVerified', 'secondPrivateDraftHiddenFromDriver',
    'secondPrivateDraftRestoredForParent', 'finalRecordReadAfterParentReturn']) assert.equal(run[key], true, key);
  for (const key of ['processIdsIndependentlyVerified', 'fullProcessRestartProven', 'twoPhoneFlowVerified',
    'notificationsVerified', 'unreadStateVerified', 'trackingVerified', 'paymentExercised', 'productionWrites',
    'videoCaptured', 'releaseEvidenceAccepted']) assert.equal(run[key], false, key);
  const session = json('session-results.json');
  assert.equal(session.scope, 'manual-team-draft-record-checkpoints-not-ui-or-release-proof');
  assert.equal(session.completed, true); assert.equal(session.projectId, run.projectId); assert.equal(session.runId, run.runId);
  assert.equal(session.testedAt, run.testedAt); assert.equal(session.adminClientClosed, true);
  assert.equal(session.fixtureEnvironmentDestroyed, false, 'Controller does not independently prove its later teardown');
  for (const key of ['physicalUiProvenByThisReport', 'fullProcessRestartProvenByThisReport', 'notificationsVerified', 'productionWrites'])
    assert.equal(session[key], false, key);
  assert.equal(session.checkpoints.length, 6); let lastTime = 0, messageId;
  for (const [index, phase] of phases.entries()) {
    const checkpoint = json(phase + '.json'), sent = index >= 3, p = checkpoint.persisted;
    assert.deepEqual(checkpoint, session.checkpoints[index]); assert.equal(checkpoint.phase, phase);
    assert.equal(checkpoint.scope, 'independent-isolated-record-checkpoint-not-phone-ui-proof');
    assert.equal(checkpoint.projectId, run.projectId); assert.equal(checkpoint.runId, run.runId);
    const time = Date.parse(checkpoint.recordedAt); assert(time > lastTime && time <= Date.parse(run.testedAt)); lastTime = time;
    assert.equal(p.messageCount, sent ? 3 : 2); assert.equal(p.messageOperationCount, sent ? 3 : 2);
    assert.equal(p.unsentDraftNotSubmitted, !sent); assert.equal(p.exactlyOneExplicitParentSend, sent);
    assert.equal(p.protectedRecordCount, 158);
    for (const key of ['protectedBaselinePreserved', 'originalClaimsUnchanged', 'expectedProfileTimestampUpdatesOnly']) assert.equal(p[key], true);
    assert.equal(checkpoint.preAdmissionMessageHiddenForParent, true); assert.equal(checkpoint.separateDriverServiceRead, true);
    assert.equal(checkpoint.phoneUiProven, false);
    if (!sent) assert.equal(checkpoint.messageId, null);
    else { assert.match(checkpoint.messageId, /^[a-f0-9]{64}$/); messageId ??= checkpoint.messageId; assert.equal(checkpoint.messageId, messageId); }
  }
  const connection = json('connection-policy.json'); assert.equal(connection.runId, run.runId);
  assertIsolatedTunnelSettings(connection.settings); assert.equal(connection.phoneToolbarLocalConnectionObserved, true);
  assert.equal(connection.forceLocalCheckboxObservedUnchecked, true); assert.equal(connection.privateConfigTransport, 'owner-only-named-pipe');
  const prep = json('apk-preparation.json'); assert.equal(prep.sourceCommit, run.appSourceCommit); assert.equal(prep.apkSha256, run.appSha256);
  assert.equal(prep.applicationId, 'be.sportgreenmoove.app.local'); assert.equal(prep.emulatorHost, '127.0.0.1'); assert.equal(prep.projectId, run.projectId);
  const cleanup = json('local-cleanup.json'); assert(Date.parse(cleanup.verifiedAt) >= Date.parse(run.testedAt));
  assert.equal(cleanup.helperAndBackendProcessesRemaining, 0); assert.deepEqual(cleanup.loopbackPortsRefused, [5001, 8080, 9000, 9099]);
  assert.equal(cleanup.privateSessionFileRemoved, true); assert.equal(cleanup.privateHandoffDirectoryRemoved, true);
  assert.equal(cleanup.devicePolicyChangedByThisTrial, false); assert.equal(cleanup.productionWrites, false);
  const uninstall = json('uninstall-observation.json'), closed = json('phone-session-closed.json');
  assert.match(uninstall.status, /Succesfully uninstalled your app\(s\)!/);
  assert.equal(uninstall.packageInventoryVerified, false); assert.equal(uninstall.devicePolicyChangedByThisTrial, false);
  assert.equal(closed.phoneSessionClosed, true); assert.equal(closed.uploadedAppsDashboardVisible, true);
  const review = json('visual-review.json');
  assert.deepEqual(run.publishedCaptures, Object.fromEntries(teamDraftPhoneStages.map(id => ['team-draft-phone-' + id, id + '.png'])));
  assert.deepEqual(review.reviewedOriginals, teamDraftPhoneStages.map(id => id + '.png'));
  assert.deepEqual(review.published, run.publishedCaptures);
  const times = Object.values(review.originalHostSaveTimes).map(Date.parse);
  assert.equal(times.length, 8); assert(times.every((time, index) => time > (times[index - 1] ?? 0)));
  assert(lastTime > times.at(-1), 'Final record read must follow the returned-parent capture');
  for (const file of Object.values(run.publishedCaptures)) {
    const png = read(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  assertRetainedSourceFiles(root, session.sourceFiles);
  const hashes = json('artifact-sha256.json');
  for (const file of ['results.json', 'session-results.json', 'connection-policy.json', 'local-cleanup.json', 'uninstall-observation.json',
    'phone-session-closed.json', 'apk-preparation.json', 'visual-review.json', 'first-stop-context.jpg', 'second-stop-context.jpg',
    'recording-unavailable-context.jpg', ...phases.map(id => id + '.json'), ...teamDraftPhoneStages.map(id => id + '.png')]) assert(Object.hasOwn(hashes, file));
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return run;
}
