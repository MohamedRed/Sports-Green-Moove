import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

const evidenceKeys = new Set(['source', 'checksums', 'manifest']);

export function evidenceSourcePaths(content) {
  const sources = new Set(), ancestors = new Set();
  function visit(value) {
    if (value === null || typeof value !== 'object') return;
    assert(!ancestors.has(value), 'Evidence metadata cannot contain cycles');
    ancestors.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (evidenceKeys.has(key)) {
        assert(typeof child === 'string' && child.startsWith('docs/') && !child.includes('\\') &&
          posix.normalize(child) === child && !child.split('/').includes('..'), 'Evidence references must be canonical repository document paths');
        sources.add(child);
      } else visit(child);
    }
    ancestors.delete(value);
  }
  visit(content);
  return [...sources].sort();
}

export function fingerprintEvidence(root, content) {
  return Object.fromEntries(evidenceSourcePaths(content).map(source => [source,
    createHash('sha256').update(readFileSync(resolve(root, source))).digest('hex')]));
}
