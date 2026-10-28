import assert from 'node:assert/strict';
import { chatNetworkIsolatedFolder, validateChatNetworkIsolated } from '../scripts/qa/chat-network-isolated-evidence.mjs';
import {validateChatNetworkRecheck} from '../scripts/qa/chat-network-recheck-evidence.mjs';

export function validateMessagesEvidence(root, flow, captures) {
  if (flow.id !== 'messages') return;
  assert.equal(flow.status, 'partial'); assert.equal(flow.networkRecovery.checkedAt, '2026-10-27');
  assert.equal(flow.checkedAt, flow.networkRecoveryRecheck.checkedAt);
  validateChatNetworkRecheck(root, flow.networkRecoveryRecheck);
  assert.equal(flow.networkRecovery.source, chatNetworkIsolatedFolder + 'chat-network-recovery-results.json');
  const result = validateChatNetworkIsolated(root);
  for (const [id, file] of Object.entries(result.publishedCaptures)) {
    assert.equal(captures[id], chatNetworkIsolatedFolder + file);
    assert(flow.images.some(image => image.file === id));
  }
}
