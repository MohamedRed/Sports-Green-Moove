import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import test from 'node:test';
import { validateRetainedTeamAccessNative } from '../scripts/qa/team-access-native-retained.mjs';
import { teamAccessNativeChecks } from '../scripts/qa/team-access-native-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { tours } from '../partner-portal/tours.mjs';

const source = 'docs/release/evidence/team-access-native-2026-10-21/team-access-results.json';
test('completed native multi-child trial binds eleven checkpoints, seven messages, six reviewed views and cleanup', () => {
  const run = validateRetainedTeamAccessNative(process.cwd(), source);
  assert.deepEqual(run.checks.map(item => item.id), teamAccessNativeChecks);
  assert.equal(run.fixtureIsolation.committedMessages, 7);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.nativeAccess.source, source); assert.equal(flow.status, 'partial');
  assert.equal(flow.images.length, 29); assert(flow.accessAttempt.source.includes('native-send'));
  assert.deepEqual(tours[flow.id].slice(5).map(item => item.image), Object.keys(run.publishedCaptures));
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert.equal(run.guardianRenewalThroughSdkNotUi, true); assert.equal(run.notificationsVerified, false);
  assert.equal(run.physicalDevice, false); assert.equal(run.fullProcessRestartProven, false);
  assert.match(flow.remaining, /notifications/); assert.match(flow.remaining, /téléphones/);
});
const changes = [
  ['job.json', x => x.conclusion = 'failure'],
  ['artifact.json', x => x.workflow_run.head_sha = '0'.repeat(40)],
  ['team-access-results.json', x => x.fixtureIsolation.committedMessages = 6],
  ['team-access-results.json', x => x.fixtureIsolation.parentHistoryBoundariesVerified = false],
  ['team-access-results.json', x => x.physicalDevice = true],
  ['team-access-results.json', x => x.notificationsVerified = true],
  ['team-access-results.json', x => x.fullProcessRestartProven = true],
  ['team-access-results.json', x => x.guardianRenewalThroughSdkNotUi = false],
  ['team-access-device.json', x => x.checks.pop()],
  ['disposable-device-restore.json', x => x.verified = false],
  ['visual-review.json', x => x.published['team-access-verified-other'] = 'team-access-other.png'],
];
for (const [index, [file, mutate]] of changes.entries()) test(`reject altered native access evidence ${index + 1}: ${file}`, () => {
  const read = path => {
    const bytes = readFileSync(path); if (basename(path) !== file) return bytes;
    const json = JSON.parse(bytes); mutate(json); return Buffer.from(JSON.stringify(json));
  };
  assert.throws(() => validateRetainedTeamAccessNative(process.cwd(), source, read));
});
