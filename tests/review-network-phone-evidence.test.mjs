import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parse} from 'yaml';
import {assertReviewNetworkPhone, validateReviewNetworkPhone, reviewNetworkPhoneFolder} from '../scripts/qa/review-network-phone-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewNetworkPhoneFolder);
const load = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
test('original controlled-offline phone records and reviewed captures remain bound without release promotion', () => {
  assert.equal(validateReviewNetworkPhone(root).releaseComplete, false);
});
for (const [name, mutate] of [
  ['an unobserved sending spinner', (s) => {s.offlineSendingUiCaptured = true;}],
  ['independent restart proof from manual force stop', (s) => {s.independentProcessRestartProven = true;}],
  ['real-world radio loss from controlled offline mode', (s) => {s.realWorldRadioLossProven = true;}],
  ['physical post-commit response loss', (s) => {s.physicalPostCommitLostReplyProven = true;}],
  ['iOS or release completion', (s) => {s.releaseComplete = true;}],
  ['an automatic submission before retry', (_s, p) => {p.checks[3].ratingCount = 1;}],
  ['a duplicated rating after retry', (_s, p) => {p.checks[4].ratingCount = 2;}],
  ['another source APK', (s) => {s.sourceApkSha256 = '0'.repeat(64);}],
  ['an observer pretending to prove the phone UI', (_s, p) => {p.phoneUiProvenByObserver = true;}],
]) test('rejects ' + name, () => {
  const summary = load('summary'), phone = load('records/session-results'); mutate(summary, phone);
  assert.throws(() => assertReviewNetworkPhone(summary, phone));
});
test('portal preserves earlier images, dates and remaining iPhone scope', () => {
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone'); assert.equal(flow.checkedAt, '2026-10-30');
  assert.equal(flow.images.filter(row => !row.file.startsWith('review-receipt-phone-')).length, 43); assert.match(flow.remaining, /iPhone/);
  for (const name of ['offline-failed', 'parent-rated', 'parent-restored', 'driver-summary', 'driver-requests']) {
    const id = 'review-network-phone-' + name;
    assert.equal(captures[id], reviewNetworkPhoneFolder + 'captures/' + name + '.jpg');
    assert.match(flow.images.find(row => row.file === id).alt, /session.*30 octobre.*test/);
  }
});
test('smoke explicitly checks retained phone evidence without creating a device session', () => {
  const source = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert.equal(source.split('"tests/review-network-phone-evidence.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.find(row => row.name === 'Test immutable rating retries after connection loss');
  assert(step.run.includes('tests/review-network-phone-evidence.test.mjs'));
  assert(!step.run.includes('manual-review-network-phone.mjs'));
});
