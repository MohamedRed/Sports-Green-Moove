import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const [input] = process.argv.slice(2);
assert(input?.startsWith('/Users/mrr/.codex/worktrees/cb61/'));
const base = resolve(root, 'docs/release/evidence/driver-connect-2026-10-24');
assert(!existsSync(base), 'Original retained attempts must never be overwritten');
const phases = {
  'setup-failure': 'sgm-connect-red-20261024', red: 'sgm-connect-red-ui-20261024',
  'startup-failure': 'sgm-connect-green-ui-20261024', 'startup-failure-2': 'sgm-connect-green-ui-2-20261024',
  green: 'sgm-connect-green-ui-3-20261024', layout: 'sgm-connect-layout-ui-20261024',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const allowed = new Set(['results.json', 'instrumentation.txt', 'setup-cleanup.json', 'compilation.json',
  'app-startup-anr.txt', 'connect-opening.png', 'connect-narrow.png']);
mkdirSync(base, {recursive: true});
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
for (const [phase, folder] of Object.entries(phases)) {
  const from = resolve(input, folder), target = resolve(base, phase); mkdirSync(target);
  const report = JSON.parse(readFileSync(resolve(from, 'results.json')));
  assert.equal(report.completed, ['green', 'layout'].includes(phase));
  for (const [file, hash] of Object.entries(report.sourceFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/); assert(file.startsWith('android/') || file.startsWith('scripts/qa/'));
    const bytes = readFileSync(resolve(from, hash + '.txt')); assert.equal(sha(bytes), hash);
    const path = resolve(archive, hash + '.txt');
    if (existsSync(path)) assert.equal(sha(readFileSync(path)), hash);
    else writeFileSync(path, bytes, {flag: 'wx'});
  }
  for (const file of readdirSync(from).filter(file => allowed.has(file))) copyFileSync(resolve(from, file), resolve(target, file));
}
const layout = JSON.parse(readFileSync(resolve(base, 'layout/results.json')));
assert.equal(layout.expectedCases, 4); assert.equal(layout.testedAt.slice(0, 10), '2026-10-24');
writeFileSync(resolve(base, 'visual-review.json'), JSON.stringify({reviewedAt: new Date().toISOString(),
  originalThreeCaseNarrowAccepted: false, originalRejection: 'The second line of the original action label is clipped.',
  finalTwoCapturesAccepted: true, credentialsVisible: false, realCustomerDataVisible: false,
  published: ['layout/connect-opening.png', 'layout/connect-narrow.png'],
  scope: 'manual-review-of-original-compose-captures-not-physical-provider-onboarding'}, null, 2), {flag: 'wx'});
console.log('Six original attempts and their exact sources retained; unit rerun and final summary remain required.');
