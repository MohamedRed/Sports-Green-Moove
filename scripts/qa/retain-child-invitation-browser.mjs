import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { validateConnectedInvitationReport } from './child-invitation-browser-evidence.mjs';

const [input] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert(isAbsolute(input ?? ''));
const folder = resolve(root, 'docs/release/evidence/child-invitation-browser-2026-10-26');
const report = JSON.parse(readFileSync(resolve(input, 'observations.json')));
validateConnectedInvitationReport(report);
mkdirSync(folder, { recursive: true });
for (const name of ['observations.json', 'disposal.json'])
  writeFileSync(resolve(folder, name), readFileSync(resolve(input, name)), { flag: 'wx' });
for (const [file, hash] of Object.entries(report.sourceFiles)) {
  const bytes = readFileSync(resolve(root, file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, 'Source changed during the browser trial');
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes);
  else writeFileSync(archive, bytes, { flag: 'wx' });
}
const names = ['README.md', 'browser-review.json', 'observations.json', 'disposal.json'];
const hashes = Object.fromEntries(names.map(name => [name,
  createHash('sha256').update(readFileSync(resolve(folder, name))).digest('hex')]));
writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', { flag: 'wx' });
console.log('Original connected-browser observations and disposal retained; no phone completion inferred.');
