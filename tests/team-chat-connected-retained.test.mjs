import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import test from 'node:test';
import { validateRetainedTeamChatConnected } from '../scripts/qa/team-chat-connected-retained.mjs';
import { teamChatNativeChecks } from '../scripts/qa/team-chat-native-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { tours } from '../partner-portal/tours.mjs';

const source = 'docs/release/evidence/team-chat-connected-2026-10-21/team-conversation-results.json';
test('completed connected case binds nine checkpoints, independent records and restored device', () => {
  const run = validateRetainedTeamChatConnected(process.cwd(), source);
  assert.deepEqual(run.checks.map(item => item.id), teamChatNativeChecks);
  assert.equal(run.fixtureIsolation.committedMessages, 5);
  assert.equal(Object.keys(run.publishedCaptures).length, 4);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.connected.source, source); assert.equal(flow.status, 'partial');
  assert(flow.attempt.source.includes('native-peer')); assert.equal(flow.images.length, 42);
  for (const id of Object.keys(run.publishedCaptures)) assert(flow.images.some(image => image.file === id));
  assert(tours[flow.id].slice(5, 13).every(item => item.image.startsWith('team-draft-phone-')));
  assert(tours[flow.id].slice(13).every(item => item.image.startsWith('team-access-verified-')));
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert(captures[id].endsWith('/' + file));
  assert.match(flow.remaining, /notifications/); assert.match(flow.remaining, /téléphones/);
  assert.equal(run.physicalDevice, false); assert.equal(run.notificationsVerified, false);
  assert.equal(run.fullProcessRestartProven, false); assert.equal(run.externalSdkTrafficVerified, false);
});

const mutations = [
  ['job.json', x => x.conclusion = 'failure'],
  ['artifact.json', x => x.workflow_run.head_sha = '0'.repeat(40)],
  ['team-conversation-results.json', x => x.physicalDevice = true],
  ['team-conversation-results.json', x => x.notificationsVerified = true],
  ['team-conversation-results.json', x => x.fullProcessRestartProven = true],
  ['team-conversation-results.json', x => x.fixtureIsolation.committedMessages = 4],
  ['team-conversation-results.json', x => x.fixtureIsolation.originalClaimsUnchanged = false],
  ['team-conversation-device.json', x => x.checks.pop()],
  ['disposable-device-restore.json', x => x.verified = false],
  ['visual-review.json', x => x.published['team-chat-connected-draft'] = 'team-chat-native-draft-window.png'],
];
for (const [index, [file, mutate]] of mutations.entries()) test(`reject altered connected evidence ${index + 1}: ${file}`, () => {
  const read = path => {
    const bytes = readFileSync(path);
    if (basename(path) !== file) return bytes;
    const json = JSON.parse(bytes); mutate(json); return Buffer.from(JSON.stringify(json));
  };
  assert.throws(() => validateRetainedTeamChatConnected(process.cwd(), source, read));
});
