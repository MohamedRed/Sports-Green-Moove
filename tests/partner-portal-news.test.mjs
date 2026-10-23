import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionUpdates } from '../partner-portal/src/render.js';
import { content } from '../partner-portal/content.mjs';
import { validateProgressEntries } from '../partner-portal/progress-validation.mjs';

test('one completed replay supersedes older affected-flow news without deleting its history', () => {
  const updates = [{flow: 'messages', coversFlows: ['publication', 'team']}, {flow: 'team'}, {flow: 'publication'}, {flow: 'booking'}];
  const result = partitionUpdates(updates);
  assert.deepEqual(result.recent, [updates[0], updates[3]]);
  assert.deepEqual(result.previous, [updates[1], updates[2]]);
});
test('a history-only event cannot hide a newer overview entry for another flow', () => {
  const updates = [{flow: 'one'}, {flow: 'one', coversFlows: ['two']}, {flow: 'two'}];
  assert.deepEqual(partitionUpdates(updates).recent, [updates[0], updates[2]]);
});
test('the current overview shows the later interrupted replay without deleting earlier passing or failed results', () => {
  const result = partitionUpdates(content.updates);
  assert(result.recent.some(row => row.source?.includes('notification-native-attempt-2026-10-23')));
  assert(result.recent.some(row => row.source?.includes('notification-read-phone-2026-10-23')));
  assert(!result.recent.some(row => row.source?.includes('native-replay-0f91172f')));
  assert(result.previous.some(row => row.source?.includes('native-replay-0f91172f')));
  assert(!result.recent.some(row => row.source?.includes('native-copy-ce282274')));
  assert(result.previous.some(row => row.source?.includes('native-copy-ce282274')));
  assert.equal(result.recent.length, 6);
  assert.equal(result.recent.length + result.previous.length, content.updates.length);
});
test('covered flows must exist and historical evidence must remain inside the evidence folder', () => {
  const ids = new Set(content.flows.map(flow => flow.id));
  validateProgressEntries(process.cwd(), content, ids);
  for (const patch of [{coversFlows: ['unknown-flow']}, {source: 'package.json'}, {date: '2026-10-24'}]) {
    const changed = {...content, updates: [{...content.updates[0], ...patch}]};
    assert.throws(() => validateProgressEntries(process.cwd(), changed, ids));
  }
});
