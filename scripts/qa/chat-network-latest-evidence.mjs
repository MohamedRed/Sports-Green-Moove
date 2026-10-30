import {validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';

export const latestNetworkRecheckIdentity = Object.freeze({
  folder: 'docs/release/evidence/chat-network-recheck-2ffa582-2026-10-30/',
  head: '2ffa582ffb55cf7d71adf7790f1e1fe1680afa54',
  runId: '1e1858f01d145f601b79dc501ad709de', date: '2026-10-30',
  jobId: 124042665039, workflowId: 41049776265, artifactId: 12973713914,
});
export function validateLatestChatNetworkRecheck(root, reference) {
  return validateChatNetworkRecheck(root, reference, latestNetworkRecheckIdentity);
}
