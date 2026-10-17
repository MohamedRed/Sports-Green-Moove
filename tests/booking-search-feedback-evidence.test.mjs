import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertBookingUiLoss } from '../scripts/qa/booking-ui-loss-evidence.mjs';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-booking-search-feedback-2026-10-17/';
const directory = fileURLToPath(new URL(`../${base}`, import.meta.url));
const bytes = (file) => readFileSync(resolve(directory, file));
const text = (file) => bytes(file).toString();
const json = (file) => JSON.parse(text(file));
const suite = (file) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
  isArray: (name) => name === 'testcase' }).parse(text(file)).testsuite;

test('raw controller, device and screen receipts retain their original bytes', () => {
  const hashes = json('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 21);
  assert.equal(createHash('sha256').update(bytes('artifact-sha256.json')).digest('hex'),
    'b6f26411758e4535f37fc09dad1256b22392015bae2c380956eb2dcbcdc4b717');
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[\w.-]+$/);
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
    if (!file.endsWith('.png')) assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(text(file)));
  }
  assert.equal(hashes['native-layout-before.xml'], '46f58e54495270dfa7b21a940653f28d4907d2f0624dfd010a088e3bfec0d120');
});

test('the confirmed-result duplicate dispatch stays red before the controller change', () => {
  const before = suite('controller-before.xml');
  assert.equal(before.tests, 4); assert.equal(before.failures, 2); assert.equal(before.errors, 0);
  assert.deepEqual(before.testcase.filter((item) => item.failure).map((item) => item.name).sort(), [
    'aConfirmedResultCannotSubmitAgainFromTheSameSearch', 'aPendingRequestStillRejectsRepeatedTapsUntilItsReplyArrives',
  ].sort());
  for (const [file, count] of [['controller-after.xml', 7], ['controller-final.xml', 8]]) {
    const after = suite(file);
    assert.equal(after.tests, count); assert.equal(after.failures, 0); assert.equal(after.errors, 0); assert.equal(after.skipped, 0);
    assert(before.testcase.every((old) => after.testcase.some((current) => current.name === old.name)));
  }
});

test('failed semantics/height interpretations remain visible beside the successful measurement check', () => {
  for (const [file, total, failures] of [['native-layout-before.xml', 85, 2], ['native-layout-diagnostic.xml', 86, 3],
    ['native-layout-after.xml', 86, 0]]) {
    const run = suite(file);
    assert.equal(run.tests, total); assert.equal(run.failures, failures); assert.equal(run.errors, 0); assert.equal(run.skipped, 19);
  }
  const positive = suite('native-layout-after.xml').testcase.filter((item) => item.classname.endsWith('BookingFeedbackLayoutTest'));
  assert.equal(positive.length, 3); assert(positive.every((item) => !item.failure && !item.skipped));
  const probe = json('width-probe.json');
  assert.equal(probe.scope, 'controlled-reconstructed-semantics-comparison-not-phone-flow');
  assert.equal(probe.fontScale, 1.5); assert.equal(probe.measuredWidthPx, 317);
  assert.equal(probe.reportedParagraphWidthPx, 734); assert.equal(probe.remeasuredParagraphWidthPx, 317);
  assert.equal(probe.measuredHeightPx, 75); assert.equal(probe.remeasuredParagraphHeightPx, 75);
  assert.equal(probe.reportedWidthOverflow, true); assert.equal(probe.reportedHeightOverflow, false);
  assert.equal(probe.wholeLabelFitsMeasuredFrame, true);
});

test('the parent screen uses a real booking SDK with explicit matching stubs and one persisted booking', () => {
  const runId = '9c36b2e83bed87a618800ae0a4211d42';
  const run = json('booking-ui-loss.json'); assertBookingUiLoss(run, runId);
  assert.deepEqual(run.ui, json('local-booking-ui-loss.json'));
  assertInstrumentationPassed(text('native-booking-ui-passed.txt'), 1);
  for (const file of ['local-booking-ui-unconfirmed.png', 'local-booking-ui-confirmed.png']) {
    const png = bytes(file); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2400);
  }
  assert(!bytes('local-booking-ui-unconfirmed.png').equals(bytes('local-booking-ui-confirmed.png')));
});

test('a later app self-report cannot promote rejected cellular handover evidence to a full pass', () => {
  const before = json('network-handover-before.json');
  assert.equal(before.runId, '9c36b2e83bed87a618800ae0a4211d42'); assert.equal(before.completed, true);
  const cellular = before.network.find((sample) => sample.phase === 'cellular-ready');
  assert.equal(cellular.wifiEnabled, false); assert.equal(cellular.mobileDataEnabled, true);
  assert(cellular.internetTransports.includes('wifi')); assert(cellular.internetTransports.includes('cellular'));
  assert.throws(() => assertChatNetworkReceipt(before));
  assertInstrumentationPassed(text('native-network-app-before.txt'), 1);
  assert.equal(content.flows.find((item) => item.id === 'booking').status, 'partial');
});

test('the current recheck passes the booking stage but does not claim the unexercised handover', () => {
  const run = json('results.json');
  assert.equal(run.recordType, 'derived-scoped-stage-summary-not-full-run-result');
  assert.equal(run.fullRunCompleted, false);
  assert.equal(run.runId, '24b052f6ff3d35f8c5959449379c6b7f');
  assert.equal(run.sourceCommit, '9fe107960e36e7c61c817c988193e149e80a530a');
  assert.deepEqual(run.steps, [{ id: 'booking-response-loss-search-ui', status: 'passed' }]);
  assert.equal(run.testedAt, json('booking-ui-collection-recheck.json').recordedAt);
  assertBookingUiLoss(json('booking-ui-recheck.json'), run.runId);
  assertInstrumentationPassed(text('native-booking-ui-recheck.txt'), 1);
  const ordinary = suite('native-layout-recheck.xml');
  assert.equal(ordinary.tests, 88); assert.equal(ordinary.skipped, 19);
  assert.equal(ordinary.failures, 0); assert.equal(ordinary.errors, 0);
  const predicate = ordinary.testcase.filter((item) => item.classname.endsWith('LocalCellularObservationTest'));
  assert.equal(predicate.length, 2); assert(predicate.every((item) => !item.failure && !item.skipped));
  const network = json('network-preparation-recheck.json');
  assert.equal(network.runId, run.runId); assert.equal(network.completed, false);
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  assert.equal(network.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(network.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(network.handoverObservationVersion, 1);
  assert.throws(() => assertInstrumentationPassed(text('native-network-recheck.txt'), 1));
  const booking = content.flows.find((item) => item.id === 'booking');
  assert.equal(booking.ui.source, base + 'results.json');
  assert.equal(booking.checkedAt, run.testedAt.slice(0, 10));
  assert.equal(run.captureSourceRunId, json('booking-ui-loss.json').runId);
  for (const id of ['booking-retry-unconfirmed', 'booking-retry-confirmed'])
    assert(booking.images.some((image) => image.file === id && /17 octobre/.test(image.alt)));
});
