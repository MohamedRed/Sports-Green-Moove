import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parse} from 'yaml';
import {assertReviewReceiptPhone, validateReviewReceiptPhone, reviewReceiptFolder, reviewReceiptImages} from '../scripts/qa/review-receipt-phone-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..');
const load = name => JSON.parse(readFileSync(resolve(root, reviewReceiptFolder, name + '.json')));
test('stored receipts, original failed attempt, sources, screenshots and PID restart remain bound', () => {
  assert.equal(validateReviewReceiptPhone(root).releaseComplete, false);
});
for (const [name, mutate] of [
  ['a duplicate', (_s, p) => {p.checks[3].ratingCount = 2;}],
  ['a lost original timestamp', (_s, p) => {p.checks[4].originalTimestampAndFieldsPreserved = false;}],
  ['a reply that was delivered initially', (_s, p) => {p.proxy.attempts[0].responseReleased = true;}],
  ['a failed driver read', (_s, p) => {p.proxy.failed = true;}],
  ['a controller changing while live', (_s, p) => {p.sourceFilesUnchanged = false;}],
  ['fixture-submitted ratings', (_s, p) => {p.fixtureSubmittedRatings = 1;}],
  ['raw timestamp proof not exported', (s) => {s.rawRatingTimestampExported = true;}],
  ['radio loss from a controlled facade', (s) => {s.realWorldRadioLossProven = true;}],
  ['unverified package absence', (s) => {s.independentPackageAbsenceProven = true;}],
  ['release completion', (s) => {s.releaseComplete = true;}],
]) test('rejects ' + name, () => {
  const summary = load('summary'), phone = load('records/session-results'); mutate(summary, phone);
  assert.throws(() => assertReviewReceiptPhone(summary, phone));
});
test('only the new confirmation-loss requirement is closed; historical images and tour stay', () => {
  const flow = content.flows.find(row => row.id === 'ratings'); assert.equal(flow.status, 'partial');
  assert.equal(flow.images.length, 48); assert.equal(flow.tour.length, 4);
  assert.match(flow.verified, /confirmation perdue/); assert.match(flow.remaining, /iPhone.*vrai déplacement/);
  for (const name of reviewReceiptImages) {
    const id = 'review-receipt-phone-' + name;
    assert.equal(captures[id], reviewReceiptFolder + 'captures/' + name + '.jpg');
    assert.match(flow.images.find(row => row.file === id).alt, /session.*30 octobre.*test/);
  }
});
test('web smoke checks the retained proof without opening a phone', () => {
  const source = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert.equal(source.split('"tests/review-receipt-phone-evidence.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.find(row => row.name === 'Test immutable rating retries after connection loss');
  assert(step.run.includes('tests/review-receipt-phone-evidence.test.mjs'));
  assert(!step.run.includes('manual-review-receipt-loss-session.mjs'));
});
