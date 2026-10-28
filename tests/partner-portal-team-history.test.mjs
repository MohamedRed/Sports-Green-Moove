import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertHistoryPhoneReport, validateHistoryPhoneArtifacts } from '../partner-portal/team-history-phone-evidence.mjs';
import { historyPhonePhases } from '../scripts/qa/manual-team-history-checkpoints.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'docs/release/evidence/phone-team-history-2026-10-19/';
const json = (file) => JSON.parse(readFileSync(resolve(root, base, file)));
function reports() {
  return [json('results.json'), json('session-results.json'), historyPhonePhases.map((phase) => json(phase + '.json')),
    json('captures.json'), json('teardown.json')];
}
test('the one-phone history replay retains five independent checkpoints, twelve views and verified cleanup', () => {
  assert.equal(validateHistoryPhoneArtifacts(root, base + 'results.json').physicalDevice, true);
});
test('incomplete or unrelated persisted sessions cannot support a phone observation', () => {
  for (const mutate of [(r) => { r[1].completed = false; }, (r) => { r[1].physicalUiProvenByThisReport = true; },
    (r) => { r[2][1].runId = '0'.repeat(32); }]) {
    const all = reports(); mutate(all); assert.throws(() => assertHistoryPhoneReport(...all));
  }
});
test('approved-child operations or duplicate withdrawal events invalidate the phone result', () => {
  for (const mutate of [(r) => { r[2][3].state.child.allowedActions = ['withdraw']; },
    (r) => { r[2][2].state.events.push(r[2][2].state.events.at(-1)); }]) {
    const all = reports(); mutate(all); assert.throws(() => assertHistoryPhoneReport(...all));
  }
});
test('bounded native evidence cannot silently promote restart, revocation UI, payment or release acceptance', () => {
  for (const key of ['fullProcessRestartProven', 'guardianRevocationThroughUiProven', 'managerUiProvenByThisRun',
    'teamChatImplemented', 'trackingVerified', 'paymentExercised', 'releaseEvidenceAccepted']) {
    const all = reports(); all[0][key] = true; assert.throws(() => assertHistoryPhoneReport(...all), key);
  }
});
test('missing cleanup or an expanded tunnel cannot pass', () => {
  for (const mutate of [(r) => { r[4].privateSessionFileRemoved = false; },
    (r) => { r[4].helperProcessesStopped = false; }, (r) => { r[3].tunnelPolicy.forceLocal = true; }]) {
    const all = reports(); mutate(all); assert.throws(() => assertHistoryPhoneReport(...all));
  }
});
test('altered original screen context fails even when the published crop is untouched', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-history-proof-'));
  try {
    cpSync(resolve(root, base), resolve(temp, base), { recursive: true });
    cpSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'), { recursive: true });
    validateHistoryPhoneArtifacts(temp, base + 'results.json');
    writeFileSync(resolve(temp, base, 'history-withdrawn-context.jpg'), 'changed');
    assert.throws(() => validateHistoryPhoneArtifacts(temp, base + 'results.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('the private portal presents the current reviewed history without completing the team flow', () => {
  const flow = content.flows.find((item) => item.id === 'team-enrollment');
  assert.equal(flow.status, 'partial'); assert.equal(flow.historyPhone.source, base + 'results.json');
  assert.match(flow.remaining, /autres appareils/); assert.match(flow.remaining, /notifications/);
  assert.equal(flow.historyPhone.checkedAt, '2026-10-19');
  assert.equal(flow.connectionRecoveryPhone.checkedAt, '2026-10-28');
  for (const name of ['team-history-list', 'team-history-page-2', 'team-history-confirmation',
    'team-history-withdrawn', 'team-history-child', 'team-history-refreshed']) {
    assert(captures[name].startsWith(base)); assert(flow.images.some((image) => image.file === name));
    assert(flow.images.find(image => image.file === name).alt.includes('19 octobre'));
  }
});
