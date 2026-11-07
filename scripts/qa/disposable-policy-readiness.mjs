import assert from 'node:assert/strict';

export const accountCountCommand = "dumpsys account | grep -E '^[[:space:]]*Accounts: [0-9]+[[:space:]]*$'";
export const policyReadinessMarker = 'Finished calculating hasIncompatibleAccountsTask';
export function assertNoDisposableAccounts(shell) {
  // Filter on the device: account names, tokens and authentication records never leave it.
  const lines = shell(accountCountCommand).trim().split('\n');
  assert(lines.length > 0 && lines.length <= 20 && lines.every((line) => /^\s*Accounts: 0\s*$/.test(line)),
    'The disposable test device must have no accounts; none will be removed');
}
export function waitForDisposablePolicyReadiness(shell, {
  now = Date.now, sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms), timeoutMs = 90_000,
} = {}) {
  assertNoDisposableAccounts(shell);
  const deadline = now() + timeoutMs;
  while (true) {
    const state = shell('logcat', '-d', '-b', 'system', '-v', 'brief', 'DevicePolicyManager:I', '*:S');
    if (state.includes(policyReadinessMarker)) { assertNoDisposableAccounts(shell); return; }
    assert(now() < deadline, 'Device policy boot validation has not finished; do not attempt device-owner provisioning');
    sleep(Math.min(1000, deadline - now()));
  }
}
