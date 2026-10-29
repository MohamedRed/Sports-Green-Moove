import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content, captures } from '../partner-portal/content.mjs';
import { validateRideCompletionRecheck } from '../scripts/qa/ride-completion-recheck-evidence.mjs';

test('completed replay and actual phone actions retain distinct honest scope', () => {
  const report = validateRideCompletionRecheck(process.cwd(), content.rideCompletionRecheck);
  assert.equal(report.physicalPhoneUiPassed, true); assert.equal(report.physicalTrackingAccepted, false);
  for (const id of ['ride-lifecycle', 'ratings']) {
    const flow = content.flows.find(item => item.id === id);
    assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, id === 'ratings' ? content.reviewHistoryPhone.checkedAt : report.checkedAt);
    assert.equal(flow.latestEvidence, 'phone'); assert.equal(flow.ui.checkedAt, '2026-10-15');
    assert.equal(flow.local.checkedAt, '2026-10-15');
    const original = flow.images.filter(image => image.file.startsWith('ride-phone-'));
    assert.equal(original.length, id === 'ratings' ? 2 : 6);
    assert(original.every(image => image.alt.includes('23 octobre')));
  }
  for (const phase of report.screenshots) assert(captures['ride-phone-' + phase].includes('/captures/'));
  assert(!Object.values(captures).some(path => /ride-completion-recheck.*(?:phone\/|cleanup)/.test(path)));
});
test('physical ride checkpoints and evidence run in both smoke triggers', () => {
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const file of ['tests/manual-ride-phone-checkpoints.test.mjs', 'tests/ride-completion-recheck-evidence.test.mjs'])
    assert.equal(workflow.split('"' + file + '"').length - 1, 2);
  assert(workflow.includes('node --test tests/manual-ride-phone-checkpoints.test.mjs tests/ride-completion-recheck-evidence.test.mjs'));
});
for (const [file, key, value] of [
  ['summary.json', 'physicalTrackingAccepted', true],
  ['summary.json', 'releaseComplete', true],
  ['summary.json', 'earlierTransportRootCauseConfirmed', true],
  ['summary.json', 'bookingDecisionPerformedOnPhone', true],
  ['native-run.json', 'conclusion', 'failure'],
  ['phone/session-results.json', 'completed', false],
  ['cleanup.json', 'uninstallVerified', true],
]) test('reject unsupported ride recheck claim: ' + file + '/' + key, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-ride-recheck-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = dirname(content.rideCompletionRecheck.source); cpSync(base, resolve(root, base), {recursive: true});
  const path = resolve(root, base, file), row = JSON.parse(readFileSync(path)); row[key] = value;
  writeFileSync(path, JSON.stringify(row));
  assert.throws(() => validateRideCompletionRecheck(root, content.rideCompletionRecheck));
});
