import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateSupportFollowupPhone } from '../scripts/qa/support-followup-phone-evidence.mjs';
const root = resolve(import.meta.dirname, '..'), relative = 'docs/release/evidence/support-followup-phone-2026-10-22/results.json';
const base = resolve(root, relative, '..');
test('physical written response, status, reopen and account checks retain their bounded scope', () => {
  const run = validateSupportFollowupPhone(root, relative);
  assert.equal(run.independentCheckpoints, 8); assert.equal(Object.keys(run.publishedCaptures).length, 9);
  assert.equal(run.protectedRecordCount, 158); assert.equal(run.processRestartVerified, false);
});
for (const [name, file, mutate] of [
  ['phone administration', 'results.json', row => row.adminResponseUiVerifiedOnPhone = true],
  ['video', 'results.json', row => row.videoCaptured = true],
  ['process identity', 'results.json', row => row.processRestartVerified = true],
  ['live provider acceptance', 'results.json', row => row.releaseComplete = true],
  ['missing checkpoint', 'session-results.json', row => row.checkpoints.pop()],
  ['changed report', 'reopened.json', row => row.state.reports[0].id = 'different'],
  ['private note leak', 'answered.json', row => row.state.requesterView.report.reviewNote = 'INTERNAL'],
  ['foreign read permitted', 'foreign.json', row => row.fixture.foreignReadDenied = false],
  ['foreign inbox contains parent report', 'foreign.json', row => row.state.foreignList.items.push({ id: row.fixture.reportId })],
  ['lost response history', 'restored.json', row => row.state.replies.pop()],
  ['changed creation time', 'restored.json', row => row.state.reports[0].createdAt._seconds += 1],
  ['changed reply identity', 'closed.json', row => row.fixture.replyIds[0] = 'a'.repeat(64)],
  ['missing cleanup', 'disposal.json', row => row.removed.runtime = false],
  ['unreviewed image', 'results.json', row => row.publishedCaptures['support-followup-phone-restored'] = 'captures/filled.jpg'],
]) test('rejects rehashed ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-support-followup-evidence-'));
  try {
    cpSync(base, temp, { recursive: true }); const path = resolve(temp, file), row = JSON.parse(readFileSync(path));
    mutate(row); writeFileSync(path, JSON.stringify(row));
    const manifest = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
    hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
    assert.throws(() => validateSupportFollowupPhone(temp, 'results.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
