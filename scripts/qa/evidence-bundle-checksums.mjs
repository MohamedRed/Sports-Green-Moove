import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function assertEvidenceBundleChecksums(base) {
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))), files = [];
  const walk = directory => {
    for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
      const file = directory ? directory + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(file);
      else {
        assert(entry.isFile(), 'Evidence cannot contain symbolic links');
        if (!['README.md', 'artifact-sha256.json'].includes(file)) files.push(file);
      }
    }
  };
  walk(''); assert(files.length > 0);
  assert.deepEqual(Object.keys(hashes).sort(), files.sort(), 'Every original artifact must be checksummed');
  for (const [file, expected] of Object.entries(hashes)) {
    assert(resolve(base, file).startsWith(base + sep)); assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex'), expected, file);
  }
}
