import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateSessionRestorationRecovery } from '../scripts/qa/session-restoration-recovery.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = process.cwd(), folder = 'docs/release/evidence/session-restoration-native-2026-10-21';
const source = folder + '/session-restoration-results.json';
const read = file => JSON.parse(readFileSync(resolve(root, folder, file)));
test('the later recovery keeps exact requests, source-bound native evidence and disposal without accepting earlier failures', () => {
  const run = validateSessionRestorationRecovery(root, source);
  assert.equal(run.testedAt.slice(0, 10), '2026-10-21'); assert.equal(run.restorationAttempts, 4);
  const flow = content.flows.find(item => item.id === 'session-restoration');
  assert.equal(flow.status, 'partial'); assert.equal(flow.restorationRecovery.source, source);
  assert.equal(flow.ui.checkedAt, '2026-10-20'); assert.equal(flow.restorationRecovery.checkedAt, '2026-10-21');
  assert.equal(flow.images.filter(row => !row.file.startsWith('session-current-')).length, 8);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(step => step.image.startsWith('session-recheck-')));
  assert.deepEqual(flow.images.filter(image => image.file.startsWith('session-recheck-')).map(image => image.file).sort(), Object.keys(run.publishedCaptures).sort());
  for (const [id, file] of Object.entries(run.publishedCaptures)) assert.equal(captures[id], folder + '/' + file);
  assert.match(flow.remaining, /vraie coupure/); assert.match(flow.remaining, /précédentes/);
  assert(flow.restorationRecheck.source.includes('session-restoration-transport-2026-10-21'));
});
function bundle(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-recovery-retained-')); t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(resolve(root, folder), resolve(temp, folder), { recursive: true });
  for (const hash of Object.values(read('session-restoration-results.json').sourceFiles)) {
    const file = 'docs/release/evidence/source-archive/' + hash + '.txt';
    mkdirSync(dirname(resolve(temp, file)), { recursive: true }); cpSync(resolve(root, file), resolve(temp, file));
  }
  return { root: temp, mutate(file, change) {
    const value = JSON.parse(readFileSync(resolve(temp, folder, file))); change(value);
    writeFileSync(resolve(temp, folder, file), JSON.stringify(value));
    const hashes = read('artifact-sha256.json');
    for (const key of Object.keys(hashes)) hashes[key] = createHash('sha256').update(readFileSync(resolve(temp, folder, key))).digest('hex');
    writeFileSync(resolve(temp, folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  } };
}
for (const [label, file, mutate] of [
  ['failed job', 'job.json', value => { value.conclusion = 'failure'; }],
  ['wrong source', 'artifact.json', value => { value.workflow_run.head_sha = 'a'.repeat(40); }],
  ['wrong run', 'artifact.json', value => { value.workflow_run.id++; }],
  ['wrong artifact', 'artifact.json', value => { value.id++; }],
  ['extra retry', 'session-restoration-proxy.json', value => { value.attempts.push(value.attempts[0]); }],
  ['wrong identity', 'local-session-restoration-device.json', value => { value.uid = 'sgm-qa-driver'; }],
  ['incomplete case', 'session-restoration-suite-status.json', value => { value.status = 1; }],
  ['missing cleanup', 'disposable-device-restore.json', value => { value.verified = false; }],
  ['fabricated media', 'visual-review.json', value => { value.mediaEdits = true; }],
  ['physical promotion', 'visual-review.json', value => { value.physicalDevice = true; }],
  ['whole workflow promotion', 'visual-review.json', value => { value.wholeWorkflowSuccessClaimed = true; }],
]) test(`${label} is rejected even with a rebound retained-file checksum manifest`, t => {
  const copy = bundle(t); copy.mutate(file, mutate); assert.throws(() => validateSessionRestorationRecovery(copy.root, source));
});
