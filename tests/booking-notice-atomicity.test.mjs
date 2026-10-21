import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateBookingNoticeRun, validateRetainedBookingNotices } from '../scripts/qa/booking-notice-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const source = 'docs/release/evidence/booking-notice-atomicity-2026-10-21/after.json';
const read = path => readFileSync(path, 'utf8');
test('twelve actual notice/decision scenarios retain rollback, retries, recipients and separate UI scope', () => {
  const run = validateRetainedBookingNotices(process.cwd(), source);
  assert.equal(run.steps.length, 12);
  const flow = content.flows.find(item => item.id === 'booking');
  assert.equal(flow.noticeChecks.source, source); assert.equal(flow.noticeChecks.checkedAt, run.testedAt.slice(0, 10));
  assert.equal(flow.status, 'partial'); assert.match(flow.remaining, /téléphone/);
  const before = JSON.parse(read(source.replace('after.json', 'before.json')));
  assert.equal(before.completed, false); assert.deepEqual(before.steps, []);
  assert.equal(before.isolatedEnvironmentDestroyed, true); assert.equal(before.emulatorEndpoints.closed, true);
  assertRetainedSourceFiles(process.cwd(), before.sourceFiles);
  const broader = JSON.parse(read(source.replace('after.json', 'regression-interrupted.json')));
  assert.equal(broader.completed, false); assert.equal(broader.expectedGroupCount, 24);
  assert.equal(broader.groups.filter(row => row.status === 'passed').length, 19);
  assert.equal(broader.groups.filter(row => row.status === 'failed').length, 5);
  assert.equal(broader.finalServiceReportRetained, false); assert.equal(broader.diskExhaustionProven, false);
  assert.equal(broader.emulatorEndpoints.closed, true);
});
for (const mutate of [run => run.steps.pop(), run => run.steps[0].status = 'failed', run => run.completed = false,
  run => run.observations[2].notices.push('bookingDecision_' + '0'.repeat(64)),
  run => run.observations[1].notices = [...run.observations[0].notices], run => run.protectedRecordCount = 0,
  run => run.physicalDevice = true, run => run.pushDeliveryVerified = true, run => run.productionWrites = true,
  run => run.emulatorEndpoints.closed = false, run => run.isolatedEnvironmentDestroyed = false])
  test(`rejects unsupported notice proof: ${mutate}`, () => {
    const run = JSON.parse(read(source)); mutate(run); assert.throws(() => validateBookingNoticeRun(run));
  });
test('booking decisions create notices inside the same transaction and both CI paths execute real failure checks', () => {
  for (const path of ['functions/src/callables/bookings.ts', 'functions/src/callables/reservations.ts']) {
    const code = read(path); assert(!code.includes('notifyUsers'));
    assert(code.includes('createBookingNotifications(transaction,'));
  }
  const helper = read('functions/src/lib/bookingNotifications.ts'); assert(helper.includes('transaction.create(ref,'));
  assert(helper.includes('new Set(userIds.filter(Boolean))')); assert(!helper.includes('transaction.set('));
  for (const path of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = read('.github/workflows/' + path);
    assert(workflow.includes('npm run test:booking-notices')); assert(workflow.includes('tests/booking-notice-atomicity.test.mjs'));
  }
  assert(read('scripts/build-partner-portal.mjs').includes('flow.noticeChecks'));
});
