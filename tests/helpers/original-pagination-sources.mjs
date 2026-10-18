import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = 'docs/release/evidence/membership-cursor-2026-10-18/';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url));
export function assertOriginalPaginationSources(sources, frozenPaths) {
  const history = JSON.parse(read(base + 'historical-sources.json'));
  assert.equal(history.sourceCommit, '9c9d94659c196b24cd6f1005ec4f8f8f07865953');
  for (const path of frozenPaths) assert(Object.hasOwn(sources, path) && Object.hasOwn(history.files, path), path);
  for (const [path, hash] of Object.entries(sources)) {
    const frozen = frozenPaths.includes(path);
    if (frozen) assert.equal(history.files[path].sha256, hash, path);
    const original = frozen ? base + history.files[path].file : path;
    assert.equal(createHash('sha256').update(read(original)).digest('hex'), hash, path);
  }
}
