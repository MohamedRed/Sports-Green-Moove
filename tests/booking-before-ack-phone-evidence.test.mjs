import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parse} from 'yaml';
import {content, captures} from '../partner-portal/content.mjs';
import {assertBookingBeforeAck, validateBookingBeforeAck, bookingBeforeAckFolder as folder,
  bookingBeforeAckImages} from '../scripts/qa/booking-before-ack-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), read = file => readFileSync(resolve(root, file), 'utf8');
const json = file => JSON.parse(read(folder + file + '.json'));
const reports = () => ({summary: json('summary'), phone: json('records/session-results'), baseline: json('records/baseline').baseline});
test('one held response spans actual Android force stop, restored login and pending request without resubmission', () => {
  const run = validateBookingBeforeAck(root);
  assert.equal(run.recordCheckpoints, 9); assert.equal(run.processRestartBeforeAcknowledgement, true);
  assert.equal(run.independentPidMeasurement, false); assert.equal(run.explicitRetryAfterRestart, false);
});
for (const key of ['bookings', 'bookingRequestReceipts', 'notifications'])
  test('a second ' + key + ' record invalidates restart proof', () => {
    const r = reports(), rows = r.phone.checks[4].state.documents[key];
    rows.push(structuredClone(rows.at(-1)));
    assert.throws(() => assertBookingBeforeAck(r.summary, r.phone, r.baseline));
  });
test('changed committed timestamps, foreign records or claims fail independently of counts', () => {
  for (const mutate of [
    r => r.phone.checks[5].state.documents.bookings.at(-1).data.createdAt = 'changed',
    r => r.phone.checks[6].state.documents.trips[0].data.seatsAvailable--,
    r => r.phone.checks[7].state.claims[0].claims.unapprovedClaim = true,
  ]) {const r = reports(); mutate(r); assert.throws(() => assertBookingBeforeAck(r.summary, r.phone, r.baseline));}
});
test('releasing the response, entering recovery or acknowledging a second call cannot pass this scenario', () => {
  for (const mutate of [
    value => value.attempts[0].responseReleased = true,
    value => value.phase = 'recover',
    value => value.attempts.push(structuredClone(value.attempts[0])),
  ]) {const r = reports(); mutate(r.phone.proxy); assert.throws(() => assertBookingBeforeAck(r.summary, r.phone, r.baseline));}
});
for (const key of ['independentPidMeasurement', 'explicitRetryAfterRestart', 'searchScreenRecoveryProven', 'multipleDevicesTested',
  'driverNotificationUiReviewed', 'installedBytesIndependentlyVerified', 'realWorldRadioLossProven', 'iosUiExecuted', 'releaseComplete'])
  test('rejects unsupported ' + key + ' promotion', () => {
    const r = reports(); r.summary[key] = true;
    assert.throws(() => assertBookingBeforeAck(r.summary, r.phone, r.baseline));
  });
test('a controller-made booking, changed source or missing force-stop observation does not pass', () => {
  for (const mutate of [
    r => r.phone.controllerSubmittedBooking = true,
    r => r.phone.sourceFilesUnchanged = false,
    r => delete r.phone.sourceFiles['scripts/qa/booking-receipt-checkpoint-plan.mjs'],
    r => r.summary.androidForceStopDisabledAfterConfirmation = false,
  ]) {const r = reports(); mutate(r); assert.throws(() => assertBookingBeforeAck(r.summary, r.phone, r.baseline));}
});
test('rehashed system observations cannot place relaunch before Android force stop', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-booking-before-ack-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, folder); cpSync(resolve(root, folder), base, {recursive: true});
  const times = json('system-ui-observations'); times.reopened = times.before;
  const bytes = JSON.stringify(times); writeFileSync(resolve(base, 'system-ui-observations.json'), bytes);
  const hashes = json('artifact-sha256');
  hashes['system-ui-observations.json'] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateBookingBeforeAck(temp));
});
test('four new session crops retain all five explicit-retry crops and the older confirmation tour', () => {
  const flow = content.flows.find(row => row.id === 'booking');
  assert.equal(flow.status, 'partial'); assert.equal(flow.bookingBeforeAckPhone.source, folder + 'summary.json');
  for (const name of bookingBeforeAckImages) {
    const image = flow.images.find(row => row.file === 'booking-before-ack-' + name);
    assert.match(image.alt, /capture de session du 30 octobre/);
    assert.equal(captures[image.file], folder + 'captures/' + name + '.jpg');
  }
  assert.equal(flow.images.filter(row => row.file.startsWith('booking-receipt-phone-')).length, 5);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(row => row.image.startsWith('booking-direct-')));
  assert.match(flow.remaining, /pour un enfant.*recherche.*deux téléphones/);
});
test('the evidence and plan checks run in smoke without starting a device', () => {
  const source = read('.github/workflows/web-integration-smoke.yml'), workflow = parse(source);
  for (const file of ['booking-before-ack-phone-evidence', 'booking-receipt-checkpoint-plan'])
    assert.equal(source.split('"tests/' + file + '.test.mjs"').length - 1, 2);
  const step = workflow.jobs.smoke.steps.find(row => row.name === 'Test isolated booking reply-loss guards');
  assert(step.run.includes('tests/booking-before-ack-phone-evidence.test.mjs'));
  assert(step.run.includes('tests/booking-receipt-checkpoint-plan.test.mjs'));
  assert(!step.run.includes('manual-booking'));
});
