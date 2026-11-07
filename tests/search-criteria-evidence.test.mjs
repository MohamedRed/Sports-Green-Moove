import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const read = (file) => readFileSync(new URL(`../docs/release/evidence/local-search-criteria-2026-10-15/${file}`, import.meta.url), 'utf8');
test('search criteria claims require the actual 32 passing state/payload cases', () => {
  for (const [file, count] of [['binding-passed.xml', 5], ['criteria-passed.xml', 9], ['payload-passed.xml', 3],
    ['requests-passed.xml', 4], ['lifecycle-passed.xml', 6], ['safety-passed.xml', 5]]) {
    assert(read(file).includes(`tests="${count}" skipped="0" failures="0" errors="0"`));
  }
  assert(read('binding-baseline-failed.xml').includes('tests="5" skipped="0" failures="5" errors="0"'));
});
test('multi-seat claims require persisted service counts and keep payment/phone scope open', () => {
  const run = JSON.parse(read('services.json'));
  assert.equal(run.steps.length, 14);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(run.scenarios.multiSeat, { requestedSeats: 2, seatsBefore: 4, seatsAfterApproval: 2,
    seatsAfterCancellation: 4, repeatedCancellationRejected: true, livePayment: false });
  const booking = content.flows.find((flow) => flow.id === 'booking');
  assert.equal(booking.status, 'partial');
  assert(booking.local.groups.includes('multi-seat-booking'));
  assert.match(booking.remaining, /téléphone|remboursements/);
});

test('options screen and native seat claims require the completed fourteen-case local run', () => {
  const base = new URL('../docs/release/evidence/local-search-options-ui-2026-10-16/', import.meta.url);
  const run = JSON.parse(readFileSync(new URL('results.json', base), 'utf8'));
  assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.testCount, 14);
  assert.equal(run.steps.length, 15);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.caseCount, 4);
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  assert.equal(run.multiSeatSdk.method, 'native-sdk-not-ui');
  assert.equal(run.multiSeatSdk.requestedSeats, 2);
  assert.equal(run.multiSeatSdk.seatsBefore, 4);
  assert.equal(run.multiSeatSdk.seatsAfterApproval, 2);
  assert.equal(run.multiSeatSdk.seatsAfterCancellation, 4);
  assert.equal(run.multiSeatSdk.repeatedCancellationRejected, true);
  for (const [classes, count] of [
    ['LocalAppFlowTest-LocalDriverFlowTest-LocalLandscapeLoginTest-LocalUiRegressionTest-SearchSessionFlowTest-SearchCriteriaFlowTest', 9],
    ...['LocalThemeRestartTest', 'LocalMultiSeatSdkTest', 'LocalRideFlowTest', 'LocalChatFlowTest', 'LocalConversationDirectoryFlowTest'].map((name) => [name, 1]),
  ]) {
    const raw = readFileSync(new URL(`${classes}-instrumentation.txt`, base), 'utf8');
    assert.match(raw, new RegExp(`OK \\(${count} tests?\\)`));
    assert(!/FAILURES|INSTRUMENTATION_FAILED/.test(raw));
  }
  const flow = content.flows.find((item) => item.id === 'search');
  assert.equal(flow.ui.checkedAt, run.testedAt.slice(0, 10));
  assert.equal(flow.phone.checkedAt, '2026-10-18');
  assert.equal(flow.status, 'partial');
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});
