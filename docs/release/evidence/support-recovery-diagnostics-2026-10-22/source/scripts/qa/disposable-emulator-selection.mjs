import assert from 'node:assert/strict';

export function selectDisposableEmulator(inventory, requested) {
  assert.equal(typeof inventory, 'string');
  const candidates = inventory.split('\n').map(line => line.trim())
    .filter(line => line.startsWith('emulator-')).map(line => {
      const match = line.match(/^(emulator-\d+)\s+(\S+)(?:\s+.*)?$/);
      assert(match, 'Unrecognized disposable emulator inventory');
      return { serial: match[1], state: match[2] };
    });
  assert.equal(new Set(candidates.map(row => row.serial)).size, candidates.length, 'Duplicate emulator inventory');
  if (requested !== undefined) assert.match(requested, /^emulator-\d+$/, 'Emulator serial required');
  else assert.equal(candidates.length, 1, 'Exactly one disposable emulator must be connected');
  const selected = requested === undefined ? candidates[0] : candidates.find(row => row.serial === requested);
  assert(selected, 'Select one available disposable Android emulator');
  assert(['device', 'offline'].includes(selected.state), 'Disposable emulator is not authorized or recognized');
  return selected.serial;
}
