import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function assertExactPixelFrames(actual, expected, expectedBytes) {
  assert(Buffer.isBuffer(actual) && Buffer.isBuffer(expected), 'Decoded frames must be buffers');
  assert(Number.isSafeInteger(expectedBytes) && expectedBytes > 0, 'A complete frame size is required');
  assert.equal(actual.length, expectedBytes, 'Actual RGB frame length');
  assert.equal(expected.length, expectedBytes, 'Original crop RGB frame length');
  if (actual.equals(expected)) return;
  // Formatting a deep diff of half a million bytes can exhaust the test runner.
  let firstDifferentByte = 0;
  while (actual[firstDifferentByte] === expected[firstDifferentByte]) firstDifferentByte++;
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.fail('Decoded RGB pixels differ: ' + JSON.stringify({bytes: expectedBytes, firstDifferentByte,
    actualSha256: sha256(actual), expectedSha256: sha256(expected)}));
}
