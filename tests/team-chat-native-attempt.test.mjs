import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTeamChatNativeAttempt } from '../scripts/qa/team-chat-native-attempt.mjs';
import { content } from '../partner-portal/content.mjs';
test('startup ANR remains negative evidence with restoration and runtime verification distinguished', () => {
  const run = validateTeamChatNativeAttempt(process.cwd(), 'docs/release/evidence/team-chat-native-startup-2026-10-21/results.json');
  assert.equal(run.nativeSuiteCompleted, false); assert.deepEqual(run.flowCheckpointsVerified, []);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.status, 'partial'); assert.equal(flow.attempt.source, 'docs/release/evidence/team-chat-native-peer-2026-10-21/results.json');
  assert.match(flow.summary, /reste à terminer/);
});
test('partial SDK exchange retains its failed case and never accepts all checkpoints or persisted-state proof', () => {
  const run = validateTeamChatNativeAttempt(process.cwd(), content.flows.find(item => item.id === 'team-conversation').attempt.source);
  assert.equal(run.sdkExchangeObserved, true); assert.equal(run.nativeCaseCompleted, false);
  assert.equal(run.independentStoredStateVerified, false); assert.equal(Object.keys(run.publishedCaptures).length, 2);
});
