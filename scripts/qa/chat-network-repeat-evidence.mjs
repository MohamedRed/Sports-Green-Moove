import assert from 'node:assert/strict';
import {validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';

export const networkRepeatIdentity = Object.freeze({
  folder: 'docs/release/evidence/chat-network-repeat-9abc639-2026-10-30/',
  head: '9abc639369a9d2a40a7917a578a981c7d5953ce6',
  runId: 'f1d3a73f75531dbb24c550dbe3fcb0e2', date: '2026-10-30',
  jobId: 124201947693, workflowId: 41096043272, artifactId: 12996777529,
});
export function validateChatNetworkRepeat(root, reference) {
  const run = validateChatNetworkRecheck(root, reference, networkRepeatIdentity);
  assert.equal(run.sourceFiles['scripts/qa/local-network-validation-diagnostics.mjs'],
    '9eec6680564800f72e806c9b1a3115da348d780bf3a76f969ab303227d36b064');
  assert.equal(run.sourceFiles['scripts/qa/wait-disposable-wifi.mjs'], undefined,
    'The later passive prerequisite did not cause this earlier successful trial');
  return run;
}
