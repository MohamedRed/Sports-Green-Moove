import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {assertEvidenceArtifactsCommitted} from '../partner-portal/committed-evidence.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-committed-evidence-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '-q'); git('config', 'user.name', 'Synthetic QA'); git('config', 'user.email', 'qa@example.test');
  writeFileSync(resolve(root, '.gitignore'), '*.log\n');
  const directory = 'docs/release/evidence/fixture'; mkdirSync(resolve(root, directory), {recursive: true});
  writeFileSync(resolve(root, directory, 'diagnostic.log'), 'synthetic original');
  const hash = createHash('sha256').update('synthetic original').digest('hex');
  writeFileSync(resolve(root, directory, 'artifact-sha256.json'), JSON.stringify({'diagnostic.log': hash}));
  writeFileSync(resolve(root, directory, 'summary.json'), '{}');
  git('add', '.'); git('commit', '-qm', 'Prepare synthetic evidence');
  const content = {record: {source: directory + '/summary.json', checksums: directory + '/artifact-sha256.json'}};
  return {root, directory, git, content};
}
test('a clean checkout with an ignored original log cannot be published as complete evidence', t => {
  const f = fixture(t); assert.equal(f.git('status', '--porcelain'), '');
  assert.throws(() => assertEvidenceArtifactsCommitted(f.root, f.content, f.git('rev-parse', 'HEAD')), /diagnostic\.log/);
});
test('adding the original to the index is insufficient until the publication commit contains it', t => {
  const f = fixture(t); f.git('add', '-f', f.directory + '/diagnostic.log');
  assert.throws(() => assertEvidenceArtifactsCommitted(f.root, f.content, f.git('rev-parse', 'HEAD')), /diagnostic\.log/);
  f.git('commit', '-qm', 'Retain original');
  assert.equal(assertEvidenceArtifactsCommitted(f.root, f.content, f.git('rev-parse', 'HEAD')), 3);
});
test('the canonical publishing command checks committed evidence before replacing the Sites snapshot', () => {
  const source = readFileSync(new URL('../scripts/prepare-partner-portal-publish.mjs', import.meta.url), 'utf8');
  assert(source.includes('assertEvidenceArtifactsCommitted(root, content, commit)'));
  assert(source.indexOf('assertEvidenceArtifactsCommitted(root, content, commit)') < source.indexOf("rmSync(resolve(destination, 'dist')"));
});
