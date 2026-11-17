import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {posix, resolve} from 'node:path';
import {evidenceSourcePaths} from './evidence-fingerprints.mjs';

export function assertEvidenceArtifactsCommitted(root, content, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  const paths = new Set(evidenceSourcePaths(content));
  for (const source of [...paths]) {
    if (!source.endsWith('/artifact-sha256.json')) continue;
    const manifest = JSON.parse(readFileSync(resolve(root, source), 'utf8'));
    assert(manifest && !Array.isArray(manifest) && typeof manifest === 'object');
    for (const [file, hash] of Object.entries(manifest)) {
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert(file && !file.includes('\\') && !posix.isAbsolute(file) &&
        posix.normalize(file) === file && !file.split('/').includes('..'));
      paths.add(posix.join(posix.dirname(source), file));
    }
  }
  const tracked = new Set(execFileSync('git', ['ls-tree', '-rz', '--name-only', commit, '--', 'docs'],
    {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}).split('\0').filter(Boolean));
  for (const path of paths) assert(tracked.has(path), `Publication evidence is absent from the source commit: ${path}`);
  return paths.size;
}
