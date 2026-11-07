import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalMockPermission, setLocalMockPermission } from '../scripts/qa/local-mock-location-permission.mjs';

test('mock-location policy reads explicit and declared default modes without assuming an absent mode', () => {
  assert.equal(readLocalMockPermission(() => 'MOCK_LOCATION: allow; time=+2s ago\n'), 'allow');
  assert.equal(readLocalMockPermission(() => 'No operations.\nDefault mode: deny\n'), 'deny');
  for (const response of ['', 'No operations.', 'Uid mode: allow\nMOCK_LOCATION: allow', 'MOCK_LOCATION: allow\nMOCK_LOCATION: deny'])
    assert.throws(() => readLocalMockPermission(() => response));
});
test('a temporary mock grant and restoration affect only the isolated local package', () => {
  let mode = 'deny'; const calls = [];
  const shell = (...args) => {
    calls.push(args); assert.equal(args[2], 'be.sportgreenmoove.app.local');
    if (args[1] === 'set') { mode = args[4]; return ''; }
    return `MOCK_LOCATION: ${mode}; time=+1s ago`;
  };
  const original = readLocalMockPermission(shell);
  setLocalMockPermission(shell, 'allow'); setLocalMockPermission(shell, original);
  assert.equal(mode, 'deny'); assert.equal(calls.filter((args) => args[1] === 'set').length, 2);
});
test('an unverified change or unsupported mode cannot be called restored', () => {
  assert.throws(() => setLocalMockPermission(() => 'MOCK_LOCATION: deny', 'allow'));
  assert.throws(() => setLocalMockPermission(() => '', 'unexpected'));
});
