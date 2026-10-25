import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assertParentPhoneBooking } from '../scripts/qa/browserstack-parent-booking-evidence.mjs';
import { validatePhoneEvidence } from '../partner-portal/phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { detail } from '../partner-portal/src/render.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'docs/release/evidence/browserstack-isolated-booking-2026-10-18/';
const bytes = (name) => readFileSync(new URL('../' + base + name, import.meta.url));
const json = (name) => JSON.parse(bytes(name));
const run = json('results.json'), checkpoints = ['requested', 'approved', 'cancelled'].map((phase) => json(phase + '.json'));
const driver = json('driver-approval.json'), policy = json('connection-policy.json');

test('actual phone parent journey joins one booking, one receipt, peer approval and restored capacity', () => {
  assertParentPhoneBooking(run, checkpoints, driver, policy);
  assert.equal(run.runId, 'edd9407bfe61370693403d569b5dfcd4');
  assert.equal(run.testedAt, '2026-10-18T11:04:49.796Z');
  assert.equal(checkpoints[0].bookingId, '5Kvit8fft3gOM9o1IcQm');
  validatePhoneEvidence(root, { source: base + 'results.json' }, '2026-10-18');
});

test('the phone checkpoint join rejects duplicate, cross-account, stale, paid or overstated evidence', () => {
  for (const change of [
    (c) => { c[2].bookingId = 'other'; }, (c) => { c[1].bookingCount = 2; },
    (c) => { c[1].parentUserId = 'other'; }, (c) => { c[1].seatsAvailable = 4; },
    (c) => { c[2].requestReceiptCount = 2; }, (c) => { c[2].recordedAt = c[0].recordedAt; },
    (c) => { c[2].paymentExercised = true; }, (c) => { c[2].notifications.push(c[2].notifications[0]); },
  ]) {
    const altered = structuredClone(checkpoints); change(altered);
    assert.throws(() => assertParentPhoneBooking(run, altered, driver, policy));
  }
  for (const field of ['driverNativeUi', 'childBookingVerified', 'twoPhoneFlowVerified', 'trackingVerified', 'paymentExercised', 'productionDataWritten', 'videoCaptured'])
    assert.throws(() => assertParentPhoneBooking({ ...run, [field]: true }, checkpoints, driver, policy));
  assert.throws(() => assertParentPhoneBooking({ ...run, projectId: 'sports-green-moove-prod' }, checkpoints, driver, policy));
});

test('nine retained files stay byte exact and the three original screenshots are full device captures', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 9);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(bytes(name).toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  for (const name of run.captures) {
    const png = bytes(name); assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
});

test('private site dates phone and old local results separately without closing booking or release scope', () => {
  const flow = content.flows.find((f) => f.id === 'booking');
  assert.equal(flow.status, 'partial'); assert.equal(flow.phone.checkedAt, '2026-10-18');
  assert.equal(flow.local.checkedAt, '2026-10-17'); assert.equal(flow.ui.checkedAt, '2026-10-17');
  assert.equal(flow.phone.source, base + 'results.json');
  const historical = flow.images.filter(image => image.file.startsWith('phone-booking-')).map(image => image.file);
  assert.deepEqual(historical, ['phone-booking-requested', 'phone-booking-approved', 'phone-booking-cancelled']);
  assert(flow.tour.every(step => step.image.startsWith('search-phone-')));
  for (const [index, id] of historical.entries()) assert.equal(captures[id], base + run.captures[index]);
  assert.match(detail(flow), /Essai sur téléphone du 24 octobre 2026/);
  assert.equal(flow.searchBookingUi.checkedAt, '2026-10-20');
  for (const remaining of [/deux téléphones/, /réponses perdues/, /remboursements/, /Pas encore en ligne/]) assert.match(flow.remaining, remaining);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'partial');
});

test('CLI checkpoints require private credentials, synthetic parent identity, one request and no payment metadata', () => {
  const source = readFileSync(new URL('../scripts/qa/browserstack-parent-booking-receipt.mjs', import.meta.url), 'utf8');
  for (const check of ['statSync(sessionPath).mode & 0o077', "'demo-sgm-local-qa'", "assert.equal(snapshot.size, 1", 'parent.customClaims?.roleKeys', '!data.paymentIntentId', 'data.cancelledByUserId, parent.uid']) assert(source.includes(check), check);
  assert(!source.includes('console.log(session'));
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/browserstack-isolated-booking-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/browserstack-isolated-tunnel.test.mjs tests/browserstack-isolated-booking-evidence.test.mjs'));
});
