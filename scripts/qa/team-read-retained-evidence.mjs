import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const teamReadServiceChecks = [
  'current-admission-count-excludes-old-history-and-own-sends',
  'read-endpoint-requires-auth-authority-account-bound-window-and-exact-input',
  'concurrent-and-reconnected-replays-persist-one-private-receipt',
  'outgoing-message-does-not-create-an-incoming-receipt-or-unread-count',
  'acknowledging-selected-messages-keeps-unseen-messages-unread',
  'pre-admission-missing-and-cross-team-identities-reject-the-whole-batch',
  'contradictory-receipt-and-negative-unread-count-fail-explicitly',
  'direct-receipt-read-and-write-denied-including-manager-and-admin',
  'revocation-and-renewal-recheck-authority-and-reset-only-the-visible-history',
  'separate-team-counts-and-receipts-remain-independent',
  'exact-counts-span-pages-with-equal-timestamps-without-marking-unseen-rows',
  'current-child-role-cannot-read-or-acknowledge-with-a-stale-adult-token',
];

export function validateRetainedTeamReads(root, source, read = path => readFileSync(path)) {
  const folder = dirname(resolve(root, source)), bytes = name => read(resolve(folder, name));
  const json = name => JSON.parse(bytes(name));
  const run = json(basename(source));
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.match(run.runId, /^[a-f0-9]{32}$/);
  assert(Number.isFinite(Date.parse(run.testedAt)));
  assert.equal(run.scope, 'local-team-read-services-not-native-or-push-proof'); assert.equal(run.completed, true);
  assert.deepEqual(run.steps, teamReadServiceChecks.map(id => ({ id, status: 'passed' })));
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'notificationsVerified']) assert.equal(run[key], false);
  for (const key of ['adminClientClosed', 'isolatedEnvironmentDestroyed']) assert.equal(run[key], true);
  assert.deepEqual(run.isolation, { protectedBaselinePreserved: true, originalClaimsUnchanged: true,
    expectedProfileTimestampUpdatesOnly: true, protectedRecordCount: 158 });
  assert.deepEqual(run.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assertRetainedSourceFiles(root, run.sourceFiles);
  assertRetainedSourceFiles(root, json('native-source-files.json'));
  assert.match(bytes('transcript.txt').toString(), /Passed 12 isolated team-read service scenarios/);
  assert.match(bytes('transcript.txt').toString(), /Script exited successfully \(code 0\)/);
  assert.match(bytes('native-build.txt').toString(), /BUILD SUCCESSFUL/);
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const [name, count] of [['TeamConversationWireTest', 6], ['TeamConversationStateTest', 5], ['TeamConversationReadStateTest', 5]]) {
    const suite = parser.parse(bytes(name + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    assert.equal(suite.testcase.length, count);
    for (const item of suite.testcase) for (const key of ['failure', 'error', 'skipped']) assert(!Object.hasOwn(item, key));
  }
  const manifest = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(manifest).sort(), ['services.json', 'transcript.txt', 'native-build.txt', 'local-device-startup.txt',
    'TeamConversationWireTest.xml', 'TeamConversationStateTest.xml', 'TeamConversationReadStateTest.xml', 'native-source-files.json'].sort());
  for (const [file, hash] of Object.entries(manifest)) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
  }
  return run;
}
