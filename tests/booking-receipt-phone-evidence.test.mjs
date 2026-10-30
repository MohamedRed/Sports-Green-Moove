import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parse} from 'yaml';
import {content, captures} from '../partner-portal/content.mjs';
import {assertBookingReceiptPhone, validateBookingReceiptPhone, bookingReceiptFolder as folder,
  bookingReceiptImages} from '../scripts/qa/booking-receipt-phone-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = name => JSON.parse(read(folder + name + '.json'));
function reports() {
  return {summary: json('summary'), phone: json('records/session-results'), baseline: json('records/baseline').baseline};
}
test('nine physical-phone record checkpoints retain the real commit, lost reply, exact retry and independent restart proof', () => {
  const run = validateBookingReceiptPhone(root);
  assert.equal(run.recordCheckpoints, 9); assert.equal(run.independentProcessRestartProven, true);
  assert.equal(run.processRestartBeforeAcknowledgement, false); assert.equal(run.controllerSourcesBoundByHash, true);
});
for (const key of ['bookings', 'bookingRequestReceipts', 'notifications'])
  test('rejects duplicate committed ' + key, () => {
    const r = reports(), records = r.phone.checks[2].state.documents[key];
    assert(records.length); records.push(structuredClone(records.at(-1)));
    assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  });
test('changed stored fields or timestamps after acknowledgement invalidate the proof', () => {
  for (const key of ['status', 'createdAt']) {
    const r = reports();
    r.phone.checks[4].state.documents.bookings.at(-1).data[key] = 'changed';
    assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  }
});
test('a new request, different receipt, released first reply or unacknowledged upstream fails', () => {
  for (const mutate of [
    attempts => attempts[1].requestSha256 = 'different',
    attempts => attempts[1].commit.bookingId = 'different',
    attempts => attempts[0].responseReleased = true,
    attempts => attempts[0].upstreamAcknowledged = false,
  ]) {
    const r = reports(); mutate(r.phone.proxy.attempts.filter(row => row.upstreamAcknowledged));
    assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  }
});
for (const key of ['processRestartBeforeAcknowledgement', 'searchScreenRecoveryProven', 'multipleDevicesTested',
  'driverNotificationUiReviewed', 'installedBytesIndependentlyVerified', 'realWorldRadioLossProven', 'releaseComplete',
  'productionWrites', 'realPayments'])
  test('does not promote the isolated phone trial to ' + key, () => {
    const r = reports(); r.summary[key] = true;
    assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  });
for (const key of ['controllerSubmittedBooking', 'fixtureSubmittedAdultBooking', 'phoneUiProvenByObserver'])
  test('the observer does not substitute for physical input: ' + key, () => {
    const r = reports(); r.phone[key] = true;
    assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  });
test('changing the observed sources or skipping disposal invalidates the evidence', () => {
  const r = reports(); r.phone.sourceFilesUnchanged = false;
  assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
  r.phone.sourceFilesUnchanged = true; r.phone.adminClientClosed = false;
  assert.throws(() => assertBookingReceiptPhone(r.summary, r.phone, r.baseline));
});
test('five new dated session captures preserve the original tour and every historical gallery', () => {
  const flow = content.flows.find(row => row.id === 'booking');
  assert.equal(flow.checkedAt, '2026-10-30'); assert.equal(flow.status, 'partial');
  assert.equal(flow.bookingReceiptPhone.source, folder + 'summary.json');
  const images = flow.images.filter(row => row.file.startsWith('booking-receipt-phone-'));
  assert.equal(images.length, 5);
  for (const name of bookingReceiptImages) {
    const image = images.find(row => row.file === 'booking-receipt-phone-' + name);
    assert.match(image.alt, /capture de session du 30 octobre/);
    assert.equal(captures[image.file], folder + 'captures/' + name + '.jpg');
  }
  for (const [prefix, count] of [['booking-direct-', 4], ['search-phone-', 5], ['booking-decision-phone-', 8]])
    assert.equal(flow.images.filter(row => row.file.startsWith(prefix)).length, count);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(row => row.image.startsWith('booking-direct-')));
  assert.match(flow.remaining, /fermeture avant confirmation.*recherche/);
  assert.match(flow.remaining, /deux téléphones/);
});
test('web smoke validates retained evidence without starting another phone or creating a booking', () => {
  const source = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(source.split('"tests/booking-receipt-phone-evidence.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.find(row => row.name === 'Test isolated booking reply-loss guards');
  assert.equal(step.run, 'node --test tests/booking-receipt-loss-proxy.test.mjs tests/booking-receipt-phone-evidence.test.mjs');
});
