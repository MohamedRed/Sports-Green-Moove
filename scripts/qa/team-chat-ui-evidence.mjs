import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamChatComponentScope = 'local-team-chat-components-with-fake-gateway-not-connected-or-physical';
export const teamChatComponentGroups = ['team-chat-entry-and-narrow-layout', 'team-chat-authorization-failure-hides-thread',
  'team-chat-unconfirmed-send-reuses-one-intent'];
export const teamChatCaptures = ['team-chat-narrow', 'team-chat-denied', 'team-chat-unconfirmed', 'team-chat-confirmed'];
const directoryGroups = ['empty-scanned-page-retains-cursor-and-only-approved-team-is-discoverable',
  'second-verified-parent-discovers-child-team-without-own-enrollment',
  'unrelated-club-member-and-unenrolled-manager-cannot-discover-team-chat',
  'anonymous-foreign-club-and-cross-account-cursor-are-denied',
  'native-page-contract-exposes-author-request-identity-and-current-access-version',
  'revocation-removes-directory-entry-without-removing-another-verified-parent'];
export function validateTeamChatComponents(run) {
  assert.equal(run.scope, teamChatComponentScope); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.match(run.runId, /^[a-f0-9]{32}$/); assert(!Number.isNaN(Date.parse(run.testedAt)));
  assert.equal(run.componentCaseCount, 3);
  assert.deepEqual(run.steps, teamChatComponentGroups.map(id => ({ id, status: 'passed' })));
  for (const key of ['connectedBackend', 'notificationsVerified', 'physicalDevice', 'productionWrites']) assert.equal(run[key], false, key);
  for (const key of ['devicePolicyRestored', 'localPackagesRemoved']) assert.equal(run[key], true, key);
  assert.deepEqual(Object.keys(run.screenshots).sort(), teamChatCaptures.flatMap(stem => [stem + '.png', stem + '-window.png']).sort());
  for (const hash of Object.values(run.screenshots)) assert.match(hash, /^[a-f0-9]{64}$/);
}
export function validateRetainedTeamChatUi(root, source) {
  const base = dirname(resolve(root, source)), read = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = json(basename(source)); validateTeamChatComponents(run); assertRetainedSourceFiles(root, run.sourceFiles);
  assert.equal(sha(read('instrumentation.txt')), run.transcriptSha256);
  assertInstrumentationPassed(read('instrumentation.txt').toString(), 3);
  for (const [file, hash] of Object.entries(run.screenshots)) assert.equal(sha(read(file)), hash, file);
  const review = json('visual-review.json');
  assert.equal(review.scope, 'reviewed-local-component-originals-not-connected-app-or-physical-device');
  assert.equal(review.reviewedAt, run.testedAt.slice(0, 10));
  assert.deepEqual(review.published, { 'team-chat-narrow': 'team-chat-narrow.png', 'team-chat-denied': 'team-chat-denied.png',
    'team-chat-unconfirmed': 'team-chat-unconfirmed-window.png', 'team-chat-confirmed': 'team-chat-confirmed.png' });
  assert(Object.hasOwn(review.excluded, 'team-chat-unconfirmed.png'));
  for (const key of ['fullAppSystemInsetsVerified', 'connectedExchangeVerified', 'notificationsVerified', 'videoRecorded'])
    assert.equal(review[key], false);
  for (const stem of teamChatCaptures) {
    const marker = json(stem + '.json');
    assert.equal(marker.scope, 'local-team-chat-component-with-fake-gateway-not-connected-or-physical');
    assert.equal(marker.case, stem); assert.equal(marker.completed, true);
    assert.equal(marker.imageSha256, run.screenshots[stem + '.png']);
    assert.equal(marker.windowSha256, run.screenshots[stem + '-window.png']);
  }
  const restored = json('device-restored.json'), setup = json('device-setup.json');
  assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.equal(setup.case, 'team-chat-components'); assert.equal(restored.case, setup.case);
  assert.equal(run.apkPreparation.installationsRemainedBlocked, true);
  assert.deepEqual(run.apkPreparation.apkHashes, setup.apkHashes);
  for (const [name, file] of [['be.sportgreenmoove.app.local', 'apk/debug/app-debug.apk'],
    ['be.sportgreenmoove.app.local.test', 'apk/androidTest/debug/app-debug-androidTest.apk']])
    assert.equal(run.apkHashes[file], setup.apkHashes[name]);
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.restoration.localPackagesRemoved, true); assert.equal(restored.observed.continuousGuardVerified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  const copy = json('adb-pull-team-chat-components.json');
  assert.equal(copy.runId, run.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  const directory = json('directory-services.json');
  assert.equal(directory.scope, 'local-team-chat-directory-services-not-native-ui'); assert.equal(directory.projectId, run.projectId);
  assert.deepEqual(directory.steps, directoryGroups.map(id => ({ id, status: 'passed' })));
  assert.equal(directory.testedAt.slice(0, 10), run.testedAt.slice(0, 10));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'notificationsVerified']) assert.equal(directory[key], false);
  for (const key of ['adminClientClosed', 'isolatedEnvironmentDestroyed']) assert.equal(directory[key], true);
  assert.equal(directory.isolation.protectedBaselinePreserved, true); assert.equal(directory.isolation.originalClaimsUnchanged, true);
  assert.deepEqual(directory.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assertRetainedSourceFiles(root, directory.sourceFiles);
  const messages = json('message-services-recheck.json');
  assert.equal(messages.scope, 'local-team-conversation-services-not-native-or-phone-ui'); assert.equal(messages.projectId, run.projectId);
  assert.equal(messages.testedAt.slice(0, 10), run.testedAt.slice(0, 10));
  assert.equal(messages.steps.length, 18); assert(messages.steps.every(item => item.status === 'passed'));
  for (const key of ['physicalDevice', 'nativeUiExecuted', 'productionWrites', 'notificationsVerified']) assert.equal(messages[key], false);
  for (const key of ['protectedBaselinePreserved', 'adminClientClosed', 'isolatedEnvironmentDestroyed']) assert.equal(messages[key], true);
  assert.deepEqual(messages.emulatorEndpoints, directory.emulatorEndpoints); assertRetainedSourceFiles(root, messages.sourceFiles);
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const name of ['TeamConversationStateTest', 'TeamConversationWireTest']) {
    const suite = parser.parse(read(name + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), 5);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    for (const test of suite.testcase) for (const key of ['failure', 'error', 'skipped']) assert(!Object.hasOwn(test, key));
  }
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  return run;
}
