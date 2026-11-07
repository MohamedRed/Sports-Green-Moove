import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function assertRetainedSourceFiles(root, files) {
  assert(files && typeof files === 'object' && !Array.isArray(files));
  assert(Object.keys(files).length > 0);
  for (const [file, expected] of Object.entries(files)) {
    assert.match(expected, /^[a-f0-9]{64}$/);
    const original = readFileSync(resolve(root, 'docs/release/evidence/source-archive', expected + '.txt'));
    assert.equal(createHash('sha256').update(original).digest('hex'), expected, file);
  }
}
