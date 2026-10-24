import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-retained-source-test-'));
  const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const original = Buffer.from('original tested source\n');
  const hash = createHash('sha256').update(original).digest('hex');
  return { root, archive, original, hash };
}
test('a historical source is bound to its recorded bytes rather than a subsequently edited checkout', (t) => {
  const f = fixture(t); writeFileSync(resolve(f.archive, f.hash + '.txt'), f.original);
  writeFileSync(resolve(f.root, 'module.ts'), 'later implementation\n');
  assertRetainedSourceFiles(f.root, { 'module.ts': f.hash });
});
test('missing archives fail even when the current checkout happens to match the original', (t) => {
  const f = fixture(t); writeFileSync(resolve(f.root, 'module.ts'), f.original);
  assert.throws(() => assertRetainedSourceFiles(f.root, { 'module.ts': f.hash }), /ENOENT/);
});
test('altered archived bytes cannot be rescued by matching current source or another archive', (t) => {
  const f = fixture(t); writeFileSync(resolve(f.archive, f.hash + '.txt'), 'altered');
  writeFileSync(resolve(f.root, 'module.ts'), f.original);
  assert.throws(() => assertRetainedSourceFiles(f.root, { 'module.ts': f.hash }));
});
test('invalid hash paths and absent source maps fail before reading arbitrary files', (t) => {
  const f = fixture(t);
  for (const files of [null, [], {}, { 'module.ts': '../outside' }, { 'module.ts': 'A'.repeat(64) }])
    assert.throws(() => assertRetainedSourceFiles(f.root, files));
});
