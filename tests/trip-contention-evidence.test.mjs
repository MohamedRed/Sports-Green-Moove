import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-contention-2026-10-17/';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (name) => JSON.parse(read(base + name));
const hashes = {
  'before.json': 'a1d363d7c1f7a8e5a7f27a7b1d15fbaff54760d51bd8062b7148808c0b5d20fa',
  'before.firestore.log': 'ab6c45cdcef2726e8e804108a99f00ba11dc80b4f70596f6abd4ac911a0c2709',
  'after.json': '55fccacdd95308f685e9f68b1cf17784eb52f640e6f64a32c3cf82d484cbfb2a',
  'after.firestore.log': '5edf1b1c3f903ba14fb39bb3855342a65c26d768f7befeacbdedea52c1b1a60b',
  'rejected-ordering-experiment.log': '624141dce30952504ddfe92cc1c32345e7bf4f89bb009907aa877fff3e826d42',
  'services-bootstrap-failure.json': 'ba90778bd4747e99e8acf66d3b275ca6bc72b2f261349794cf45d2acbff31552',
  'services.json': 'd414bbb5e56d40142e47e08c1d3b163f11fdeaf2dad19d214c3c272881df8d0c',
  'payments.json': '249f982cade95c8c86a742ebb2162c372494b8e782788dfd3a027e86bbc83836',
  'recheck.json': 'fbc42c91ab2e9f34b6623574411dd97095b6bbd0bb231c282633573a3855dd3b',
};

test('original failed and successful traces stay byte-preserved and isolated', () => {
  for (const [name, hash] of Object.entries(hashes)) {
    const bytes = readFileSync(new URL(`../${base}${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, name);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(bytes.toString()));
  }
  for (const name of ['before.json', 'after.json']) {
    const run = json(name);
    assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.scope, 'controlled-local-production-handlers-not-phone-ui');
    assert.equal(run.testedAt.slice(0, 10), '2026-10-17');
    assert.match(run.runId, /^[a-f0-9]{32}$/);
    assert.equal(run.livePayment, false); assert.equal(run.productionDeployed, false);
  }
});

test('the unmodified business handlers reproduce ABORTED followed by unsafe closed-token query replay', () => {
  const run = json('before.json');
  assert.equal(run.passed, false); assert.equal(run.rounds, 1);
  const result = run.cases[0];
  assert.equal(result.gateTimedOut, false);
  assert.deepEqual(result.rpc.filter((event) => event.method.endsWith('/RunQuery') && event.code !== 0)
    .map((event) => event.code), [10, 3, 3]);
  assert.equal(result.outcomes[0].code, 3); assert.equal(result.outcomes[1].status, 'fulfilled');
  assert.equal(result.reads.at(-1).phase, 'failed'); assert.equal(result.reads.at(-1).code, 3);
  assert.match(read(base + 'before.firestore.log'), /Transaction lock timeout/);
  assert.match(read(base + 'before.firestore.log'), /Transaction is invalid or closed/);
  assert.match(read(base + 'rejected-ordering-experiment.log'), /Unexpected conflict: 3/);
  assert.equal(run.sourceSha256, json('after.json').sourceSha256, 'The approved fix does not reorder booking logic');
});

test('twelve actual overlaps preserve exact domain conflicts, seats and one parent notification', () => {
  const run = json('after.json');
  assert.equal(run.passed, true); assert.equal(run.rounds, 12); assert.equal(run.cases.length, 12);
  assert.equal(new Set(run.cases.map((item) => item.tripId)).size, 12);
  let queryAbortRecovered = false;
  for (const result of run.cases) {
    assert.equal(result.gateTimedOut, false); assert.equal(result.notificationCount, 1);
    assert.equal(result.outcomes.filter((item) => item.status === 'fulfilled').length, 1);
    assert(result.outcomes.filter((item) => item.status === 'rejected')
      .every((item) => ['aborted', 'failed-precondition'].includes(item.code)));
    assert(result.rpc.length > 0 && result.rpc.every((event) => event.code !== 3));
    const cancellationRead = result.reads.findIndex((item) => item.operation === 'cancellation' && item.phase === 'completed');
    const approvalRead = result.reads.findIndex((item) => item.operation === 'approval' && item.phase === 'requested');
    assert(cancellationRead >= 0 && approvalRead > cancellationRead);
    if (result.tripStatus === 'cancelled') {
      assert.equal(result.bookingStatus, 'cancelled'); assert.equal(result.seatsAvailable, 4);
      assert.equal(result.cancellationReceiptExists, true);
      assert.deepEqual(result.outcomes[0].result.bookingIds, [result.bookingId]);
    } else {
      assert.equal(result.tripStatus, 'published'); assert.equal(result.bookingStatus, 'approved');
      assert.equal(result.seatsAvailable, 3); assert.equal(result.cancellationReceiptExists, false);
      assert.equal(result.outcomes[0].code, 'aborted');
    }
    const aborted = result.reads.findIndex((item) => item.operation === 'cancellation' && item.phase === 'failed' && item.code === 10);
    if (aborted >= 0) {
      assert(result.reads.slice(aborted + 1).some((item) => item.operation === 'cancellation' &&
        item.path === `trips/${result.tripId}` && item.phase === 'requested'));
      queryAbortRecovered = true;
    }
  }
  assert(queryAbortRecovered, 'This retained receipt proves a full transaction restart, not only an uncontended pass');
  assert(!read(base + 'after.firestore.log').includes('Transaction is invalid or closed'));
});

test('the fixture initialization failure remains failed and is not promoted from its nineteen passing groups', () => {
  const run = json('services-bootstrap-failure.json');
  assert.equal(run.steps.length, 24);
  assert.equal(run.steps.filter((item) => item.status === 'passed').length, 19);
  assert.match(run.steps.find((item) => item.id === 'fixtures').message, /Firestore has already been initialized/);
  for (const file of ['local-flow-client.mjs', 'seed-firebase-emulator.mjs', 'index-local-chat-fixtures.mjs'])
    assert(read(`scripts/qa/${file}`).includes("import('../../functions/lib/lib/firestore.js')"));
});

test('the corrected bootstrap passes every wider service group, including money and parent-agreement fences', () => {
  const run = json('services.json');
  assert.equal(run.runId, 'ea6efa36c6d80e12eec00830189944ac');
  assert.equal(run.testedAt, '2026-10-17T02:52:37.395Z');
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.steps.length, 24); assert(run.steps.every((item) => item.status === 'passed'));
  assert.equal(run.tripCancellation.races.outcomes.length, 3);
  assert(run.tripCancellation.races.outcomes.every((item) => item.consistent && item.results.every((result) =>
    ['confirmed', 'ABORTED', 'FAILED_PRECONDITION'].includes(result))));
  assert.equal(run.tripApplication.fence.paymentProposalRaceSingleWinner, true);
  assert.equal(run.tripChanges.acceptedParentCount, 2);
  assert.equal(run.tripSupplement.finalPaidCents, 550);
  assert.equal(run.tripSupplement.finalReceiptCount, 3);
  assert.equal(run.tripSupplement.duplicateEventsOneCredit, true);
  assert.equal(run.tripSupplement.cancelledBookingClosedAndRefundPending, true);
});

test('the regression is mandatory in smoke CI and has no broadened race acceptance or production deployment', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/firestore-streaming-policy.test.mjs"').length - 1, 2);
  assert.equal(workflow.split('"tests/trip-contention-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: npm run test:trip-contention/);
  assert.match(workflow, /SGM_LOCAL_FLOW_OUTPUT: \$\{\{ runner.temp \}\}\/sgm-trip-contention\/results.json/);
  assert(workflow.includes('name: trip-contention-results'));
  assert(!read('scripts/qa/local-trip-cancellation-races.mjs').includes("['ABORTED', 'FAILED_PRECONDITION', 'INTERNAL']"));
  assert.equal(content.flows.find((item) => item.id === 'publication').status, 'partial');
  const followup = content.blockers.find((item) => item.id === 'cancellation-race');
  assert.equal(followup.source, base + 'README.md');
  assert.match(followup.next, /téléphone/); assert.match(followup.next, /pas encore en ligne/);
});

test('synthetic payment reconciliation retains cancellation ordering and immutable invoices', () => {
  const run = json('payments.json');
  assert.equal(run.success, true); assert.equal(run.numTotalTests, 14);
  assert.equal(run.numPassedTests, 14); assert.equal(run.numFailedTests, 0);
  assert.equal(new Date(run.startTime).toISOString().slice(0, 10), '2026-10-17');
  const cases = run.testResults.flatMap((suite) => suite.assertionResults);
  assert(cases.every((item) => item.status === 'passed'));
  for (const order of ['payment-first', 'cancellation-first', 'concurrent'])
    assert(cases.some((item) => item.fullName.endsWith('across ' + order)));
  assert(cases.some((item) => item.fullName.includes('preserves immutable invoice and ledger bytes')));
});

test('the final shared-bootstrap recheck independently completes all twelve overlaps', () => {
  const run = json('recheck.json');
  assert.equal(run.runId, 'c246598f3a4cc48d3b65a46cf1de8713');
  assert.equal(run.testedAt, '2026-10-17T02:55:23.029Z');
  assert.equal(run.passed, true); assert.equal(run.rounds, 12); assert.equal(run.cases.length, 12);
  assert.equal(run.sourceSha256, json('after.json').sourceSha256);
  assert.equal(run.firestoreConfigSha256, json('after.json').firestoreConfigSha256);
  assert(run.cases.every((item) => !item.gateTimedOut && item.notificationCount === 1 &&
    item.rpc.every((event) => event.code !== 3) && item.outcomes.filter((outcome) => outcome.status === 'fulfilled').length === 1 &&
    item.outcomes.filter((outcome) => outcome.status === 'rejected').every((outcome) => ['aborted', 'failed-precondition'].includes(outcome.code))));
});
