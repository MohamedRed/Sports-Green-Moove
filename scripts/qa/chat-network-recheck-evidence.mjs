import assert from 'node:assert/strict';
import {validateChatNetworkReplay} from './chat-network-replay-evidence.mjs';

export const networkRecheckIdentity = Object.freeze({folder: 'docs/release/evidence/chat-network-recheck-7417e22-2026-10-28/',
  head: '7417e22703e3b89d69850248380c3223b98e1700', runId: '563a3a3136d099a569ec0b01b180b89e', date: '2026-10-28',
  jobId: 123050720893, workflowId: 40754791471, artifactId: 12844624835});

export function validateChatNetworkRecheck(root, reference) {
  const expected = networkRecheckIdentity;
  assert.deepEqual(reference, {source: expected.folder + 'chat-network-recovery-results.json', checkedAt: expected.date});
  const {run, json} = validateChatNetworkReplay(root, expected);
  const {isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app} = run;
  assert.deepEqual(json('chat-network-recovery-app-results.json'), app);
  assert.deepEqual(json('chat-network-recovery-suite-status.json'), {
    scope: 'chat-network-recovery-command-status-not-flow-verification', status: 0});
  return run;
}
