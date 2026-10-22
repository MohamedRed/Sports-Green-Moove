import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateSupportPhone } from '../scripts/qa/support-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), relative = 'docs/release/evidence/support-phone-2026-10-22/results.json';
const base = resolve(root, 'docs/release/evidence/support-phone-2026-10-22');
test('actual physical submission stays separate from requester response and management UI', () => {
  const run = validateSupportPhone(root, relative);
  assert.equal(run.independentCheckpoints, 5); assert.equal(run.protectedRecordCount, 158);
  for (const key of ['requesterResponseVerified', 'adminReviewUiVerified', 'productionWrites', 'processRestartVerified', 'releaseComplete'])
    assert.equal(run[key], false);
});
for (const [name, file, mutate] of [
  ['requester feedback', 'results.json', row => row.requesterResponseVerified = true],
  ['management UI', 'results.json', row => row.adminReviewUiVerified = true],
  ['missing checkpoint', 'session-results.json', row => row.checkpoints.pop()],
  ['substituted report', 'reopened.json', row => row.state.reports[0].id = 'another'],
  ['foreign reporter', 'submitted.json', row => row.state.reports[0].reporterUserId = 'another'],
  ['counterfeit timestamp', 'submitted.json', row => row.state.reports[0].createdAt = {}],
  ['changed creation time', 'reopened.json', row => row.state.reports[0].createdAt._seconds += 1],
  ['invented notice', 'reviewed.json', row => row.state.notifications.push({ id: 'notice' })],
  ['wrong admin', 'reviewed.json', row => row.state.reports[0].reviewEvents[0].reviewerUserId = 'parent'],
  ['missing disposal', 'cleanup.json', row => row.privateSessionRemoved = false],
  ['invented first uninstall', 'cleanup.json', row => row.firstAttemptAppUninstallVerified = true],
  ['promoted first attempt', 'first-attempt/session-results.json', row => row.completed = true],
  ['unreviewed published image', 'results.json', row => row.publishedCaptures['support-phone-submitted'] = 'reviewed-device.jpg'],
]) test('rejects rehashed ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-support-evidence-'));
  try {
    cpSync(base, temp, { recursive: true }); const target = resolve(temp, file), row = JSON.parse(readFileSync(target));
    mutate(row); writeFileSync(target, JSON.stringify(row));
    const manifest = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
    hashes[file] = createHash('sha256').update(readFileSync(target)).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
    assert.throws(() => validateSupportPhone(temp, 'results.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('portal keeps historical submission/local proofs separate from the latest written-follow-up tour', () => {
  const flow = content.flows.find(row => row.id === 'support');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-22');
  assert.equal(flow.local.checkedAt, '2026-10-15'); assert.equal(flow.ui.checkedAt, '2026-10-15');
  assert.equal(flow.latestEvidence, 'phone'); assert.match(flow.remaining, /erreurs de connexion/);
  assert.equal(flow.tour.length, 9);
  for (const step of flow.tour) assert(captures[step.image].startsWith('docs/release/evidence/support-followup-phone-2026-10-22/'));
  for (const id of ['invalid', 'filled', 'submitted', 'reopened']) assert(flow.images.some(row => row.file === 'support-phone-' + id));
  assert(flow.images.some(row => row.file === 'support-reviewed'));
  const workflow = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  for (const name of ['tests/manual-support-phone-checkpoints.test.mjs', 'tests/support-phone-evidence.test.mjs'])
    assert(workflow.split(name).length >= 4, 'Both triggers and the execution step must include ' + name);
  assert(readFileSync(resolve(root, 'scripts/build-partner-portal.mjs'), 'utf8').includes('flow.supportPhone.checksums'));
});
