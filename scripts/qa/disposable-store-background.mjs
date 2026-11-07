import assert from 'node:assert/strict';

const store = 'com.android.vending';
const modes = new Set(['allow', 'ignore', 'deny', 'default', 'foreground']);
export const storeBackgroundRestrictions = { RUN_IN_BACKGROUND: 'ignore', RUN_ANY_IN_BACKGROUND: 'deny' };

export function readStoreBackgroundMode(shell, operation) {
  assert(Object.hasOwn(storeBackgroundRestrictions, operation));
  const output = shell('cmd', 'appops', 'get', '--user', '0', store, operation);
  assert(!output.includes('Uid mode:'), 'Store pause refuses a UID-wide background override');
  const explicit = [...output.matchAll(new RegExp(`^\\s*${operation}: (allow|ignore|deny|default|foreground)(?:;|\\s|$)`, 'gm'))];
  if (explicit.length) { assert.equal(explicit.length, 1); return explicit[0][1]; }
  const declared = output.trim().match(/^No operations\.\s+Default mode: (allow|ignore|deny|default|foreground)$/);
  assert(declared, 'Store background mode unavailable; no inferred default is permitted');
  return declared[1];
}

export function readStoreBackground(shell) {
  return Object.fromEntries(Object.keys(storeBackgroundRestrictions).map((operation) => [operation, readStoreBackgroundMode(shell, operation)]));
}

export function setStoreBackground(shell, requested) {
  assert.deepEqual(Object.keys(requested).sort(), Object.keys(storeBackgroundRestrictions).sort());
  assert(Object.values(requested).every((mode) => modes.has(mode)));
  const errors = [];
  for (const [operation, mode] of Object.entries(requested)) {
    try {
      shell('cmd', 'appops', 'set', '--user', '0', store, operation, mode);
      assert.equal(readStoreBackgroundMode(shell, operation), mode, 'Store background policy was not applied');
    } catch (failure) { errors.push(failure); }
  }
  if (errors.length) throw new AggregateError(errors, 'Cannot set the selected store-only background policy');
}
