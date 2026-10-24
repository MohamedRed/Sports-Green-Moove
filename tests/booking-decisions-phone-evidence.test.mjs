import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content, captures } from '../partner-portal/content.mjs';
import { detail } from '../partner-portal/src/render.js';
import { validateBookingDecisionsPhone } from '../scripts/qa/booking-decisions-phone-evidence.mjs';

const flow = content.flows.find(item => item.id === 'booking'), source = flow.decisionPhone.source;
test('six actual phone checkpoints preserve exact recipients, two seats, capacity and all protected records', () => {
  const run = validateBookingDecisionsPhone(process.cwd(), source);
  assert.equal(run.completed, true); assert.equal(run.parentSearchOrRequestUiVerified, false);
  assert.equal(run.twoPhoneFlowVerified, false); assert.equal(run.pushDeliveryVerified, false);
});
test('the current tour retains all eight historical decision captures under the newer full exchange', () => {
  const run = validateBookingDecisionsPhone(process.cwd(), source);
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-24'); assert.equal(flow.phone.checkedAt, '2026-10-18');
  assert.match(detail(flow), /Essai sur téléphone du 24 octobre 2026/); assert.equal(flow.tour.length, 5);
  assert(flow.tour.every(step => step.image.startsWith('search-phone-')));
  assert.equal(Object.keys(run.publishedCaptures).length, 8);
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert.equal(captures[id], dirname(source) + '/' + file);
    assert(flow.images.some(image => image.file === id && image.alt.includes('22 octobre')));
  }
  assert(flow.images.some(image => image.file === 'search-booking-requested' && image.alt.includes('20 octobre')));
  assert(flow.images.some(image => image.file === 'phone-booking-requested' && image.alt.includes('18 octobre')));
  assert.equal(flow.decisionPhone.checkedAt, '2026-10-22'); assert.match(flow.remaining, /deux téléphones/);
});
test('both new evidence contracts are selected and executed by the web smoke workflow', () => {
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const file of ['tests/booking-decisions-phone-evidence.test.mjs', 'tests/native-capture-recheck-evidence.test.mjs']) {
    assert.equal(workflow.split('"' + file + '"').length - 1, 2);
    assert(workflow.includes('tests/flow-recheck.test.mjs tests/booking-decisions-phone-evidence.test.mjs tests/native-capture-recheck-evidence.test.mjs'));
  }
});
for (const [file, mutate] of [
  ['results.json', value => value.parentSearchOrRequestUiVerified = true],
  ['results.json', value => value.twoPhoneFlowVerified = true],
  ['results.json', value => value.pushDeliveryVerified = true],
  ['results.json', value => value.paymentExercised = true],
  ['results.json', value => value.releaseComplete = true],
  ['approved.json', value => value.state.trips[0].seatsAvailable = 4],
  ['driver-inbox.json', value => value.state.inboxes.outsider.push(value.state.notices[0].id)],
  ['cleanup.json', value => value.fixtureEnvironmentDestroyed = false],
  ['first-attempt/session-results.json', value => value.completed = true],
  ['startup-diagnostic.json', value => value.requestLoggingEnabled = true],
]) test('rejects a rehashed unsupported phone claim: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-booking-phone-evidence-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = resolve(root, dirname(source)); cpSync(dirname(resolve(process.cwd(), source)), base, {recursive: true});
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value);
  writeFileSync(path, JSON.stringify(value));
  const manifest = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validateBookingDecisionsPhone(root, source));
});
