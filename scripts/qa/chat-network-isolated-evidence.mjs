import assert from 'node:assert/strict';
import {validateChatNetworkReplay} from './chat-network-replay-evidence.mjs';

export const chatNetworkIsolatedFolder = 'docs/release/evidence/chat-network-isolated-2026-10-27/';
export function validateChatNetworkIsolated(root) {
  const head = '04ce4d4f073e2ba7c406e1adfe0ee6d57b433997';
  const {run, bytes, json} = validateChatNetworkReplay(root, {folder: chatNetworkIsolatedFolder,
    head, runId: '644b0af26dff97be7e8bb291766f4cc4', date: '2026-10-27',
    jobId: 122180209848, workflowId: 40501549204, artifactId: 12732624464});
  const review = json('visual-review.json'); assert.equal(review.runId, run.runId); assert.equal(review.sourceCommit, head);
  assert.deepEqual(review.published, {
    'chat-network-isolated-draft': 'captures/local-chat-network-unconfirmed.png',
    'chat-network-isolated-reply': 'captures/local-chat-network-received.png',
  });
  assert.equal(review.excluded['local-chat-network-recovered.png'], 'Incomplete window redraw; not published.');
  for (const file of Object.values(review.published)) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  return { run, publishedCaptures: review.published };
}
