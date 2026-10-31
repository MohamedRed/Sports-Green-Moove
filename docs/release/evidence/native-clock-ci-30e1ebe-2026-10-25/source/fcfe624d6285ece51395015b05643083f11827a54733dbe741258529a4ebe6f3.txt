import assert from 'node:assert/strict';

export function readLocalMockPermission(shell) {
  const output = shell('appops', 'get', 'be.sportgreenmoove.app.local', 'android:mock_location');
  assert(!output.includes('Uid mode:'), 'Refuse a UID-wide mock override');
  const explicit = [...output.matchAll(/^\s*MOCK_LOCATION: (allow|ignore|deny|default|foreground)(?:;|\s|$)/gm)];
  if (explicit.length) { assert.equal(explicit.length, 1); return explicit[0][1]; }
  const declared = output.trim().match(/^No operations\.\s+Default mode: (allow|ignore|deny|default|foreground)$/);
  assert(declared, 'Mock-location mode must be observed, not inferred'); return declared[1];
}
export function setLocalMockPermission(shell, mode) {
  assert(['allow', 'ignore', 'deny', 'default', 'foreground'].includes(mode));
  shell('appops', 'set', 'be.sportgreenmoove.app.local', 'android:mock_location', mode);
  assert.equal(readLocalMockPermission(shell), mode);
}
