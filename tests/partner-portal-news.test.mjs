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
test('the bounded overview shows current work without deleting earlier interrupted or passing results', () => {
  const result = partitionUpdates(content.updates);
  assert(result.recent.some(row => row.source?.includes('notification-read-restart-phone-2026-10-23')));
  assert.equal(result.recent[0].source, 'docs/release/evidence/commission-presentation-2026-10-24/README.md');
  assert.equal([...result.recent, ...result.previous].filter(row =>
    row.source?.includes('booking-request-phone-2026-10-23')).length, 1);
  assert(result.previous.some(row => row.source?.includes('notification-native-recovery-2026-10-23')));
  assert(result.previous.some(row => row.source?.includes('notification-native-attempt-2026-10-23')));
  assert(result.previous.some(row => row.source?.includes('notification-read-phone-2026-10-23')));
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
  const future = new Date(content.updatedAt + 'T00:00:00Z'); future.setUTCDate(future.getUTCDate() + 1);
  for (const patch of [{coversFlows: ['unknown-flow']}, {source: 'package.json'}, {date: future.toISOString().slice(0, 10)}]) {
    const changed = {...content, updates: [{...content.updates[0], ...patch}]};
    assert.throws(() => validateProgressEntries(process.cwd(), changed, ids));
  }
});
