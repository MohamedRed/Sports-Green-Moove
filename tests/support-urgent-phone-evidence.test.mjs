import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateUrgentPhoneEvidence } from '../scripts/qa/support-urgent-phone-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), source = 'docs/release/evidence/support-urgent-phone-2026-10-23/';
test('retained actual urgent phone and management flow has eight independent checkpoints and verified cleanup', () => {
  const result = validateUrgentPhoneEvidence(root, source + 'summary.json');
  assert.equal(Object.keys(result.publishedCaptures).length, 5);
});
for (const [name, file, mutate] of [
  ['email receipt', 'summary.json', x => x.realEmailSent = true],
  ['video recording', 'summary.json', x => x.videoRecorded = true],
  ['native screenshot', 'summary.json', x => x.nativeScreenshotExportObserved = true],
  ['network loss', 'summary.json', x => x.realNetworkLossVerified = true],
  ['process restart', 'summary.json', x => x.fullProcessRestartVerified = true],
  ['observer UI proof', 'checkpoints/session-results.json', x => x.physicalUiVerifiedByObserver = true],
  ['unclosed helper', 'cleanup.json', x => x.helperProcessGroupExitVerified = false],
  ['changed request', 'checkpoints/restored.json', x => x.state.reports[0].reason = 'Changed'],
  ['unprotected fixture', 'checkpoints/foreign.json', x => x.protectedRecordCount = 157],
  ['invented crop', 'capture-index.json', x => x.rectangles[0].left = 0],
]) test('rejects rehashed urgent phone evidence promoted to ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-urgent-phone-evidence-test-'));
  try {
    cpSync(resolve(root, source), temp, { recursive: true });
    const row = JSON.parse(readFileSync(resolve(temp, file))); mutate(row);
    writeFileSync(resolve(temp, file), JSON.stringify(row));
    const hashes = JSON.parse(readFileSync(resolve(temp, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(readFileSync(resolve(temp, file))).digest('hex');
    writeFileSync(resolve(temp, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateUrgentPhoneEvidence(temp, 'summary.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('the latest native terminal observation remains failed at network preparation', () => {
  const base = resolve(root, 'docs/release/evidence/native-terminal-80c88d0c-2026-10-23');
  const run = JSON.parse(readFileSync(resolve(base, 'run.json')));
  assert.equal(run.headSha, '80c88d0c33b388fcd4d9306137146172c17fe5b8');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const log = readFileSync(resolve(base, 'failure-excerpt.txt'), 'utf8');
  assert.match(log, /LocalChatNetworkFlowTest.kt:82/); assert.match(log, /ComposeTimeoutException/);
});
