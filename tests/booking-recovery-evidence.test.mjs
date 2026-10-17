import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-booking-recovery-2026-10-17/';
const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const read = (path) => bytes(path).toString();
const json = (name) => JSON.parse(read(base + name));
const hashes = {
  'before.json': 'f55f4643ba7d26a80a9c2a8d70829ea3802a1c032934c73ed50d2a935a069adc',
  'after.json': 'abf4c72dbb70d5b497023b58bb87a2bab8ba4eda836f70db913e5e98b594a1ca',
  'swift-recovery.json': 'b3696084447c27c01de1039971cfc48767edce3eb6d18e3aad079e3d25f6a431',
  'functions.json': '3608070a7df7ad09b4f544005e634695863f23890f9a5e0d80ec592299087c7e',
  'rules.json': 'f3af4afc5537de452a57b9401de4759ebb6cbc9ec7bdd3ed7c61f46826023270',
  'android-coordinator.xml': '00e0c2c5c5236339438df73165414b829e07d531aef1398a30430eef15a0441d',
  'displayed-agreement.json': 'ddf7f5dbcfce809041c03350a4ad518b10b6080f7a4f537d497a0065fedfd031',
  'transaction-consistency.json': '3b2c6b97c21d259cc4f845ff84d8caafacceba9d5df507e274ee88d5b176dbbf',
  'services.json': 'c4e4159660cd710cda9f0d18329ccee8cb797568d0d0b40f7903923a309be283',
};
test('original response-loss receipts retain their bytes and explicitly local scope', () => {
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), hash, file);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(read(base + file)));
  }
  for (const file of ['before.json', 'after.json']) {
    const run = json(file);
    assert.equal(run.scope, 'local-http-booking-post-commit-response-loss-not-native-ui');
    assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.livePayment, false); assert.equal(run.productionDeployed, false);
    assert.equal(run.testedAt.slice(0, 10), '2026-10-17');
    assert.deepEqual(run.firstError, { code: 'ECONNRESET', responseReceived: false });
    assert.equal(run.attempts[0].acknowledgementDropped, true);
    assert.equal(run.attempts[0].upstreamStatus, 200);
    assert.equal(run.attempts[0].commit.bookingId, run.original.bookingId);
    assert.equal(run.original.bookingCount, 1); assert.equal(run.original.seats, 2);
  }
});
test('the original duplicated bookings remain a failed baseline', () => {
  const run = json('before.json');
  assert.equal(run.runId, '6be3428f9893016cd4a6498b54042674');
  assert.equal(run.sourceSha256['callables/bookingRequests.ts'],
    '8b891578c7e7a536eab6e840339d5e4b623cf2fe36f46b138ca210fb773a07a1');
  assert.equal(run.passed, false); assert.equal(run.checks.length, 10);
  assert.equal(run.checks.filter((item) => item.status === 'failed').length, 5);
  assert.deepEqual(Object.values(run.stages).map((stage) => stage.bookings.length), [3, 4, 5, 6]);
  assert.equal(run.conflict.status, 200); assert(!run.races);
});
test('corrected retries recover exactly one original booking before and after decisions', () => {
  const run = json('after.json');
  assert.equal(run.runId, 'af54f39a3322292fb8f25c27e8b4f131');
  assert.equal(run.passed, true); assert.equal(run.checks.length, 10);
  assert(run.checks.every((item) => item.status === 'passed'));
  assert.deepEqual(run.checks.map((item) => item.id), json('before.json').checks.map((item) => item.id));
  assert(run.retries.every((retry) => retry.status === 200 && retry.bookingId === run.original.bookingId));
  for (const stage of Object.values(run.stages)) {
    assert.equal(stage.bookings.length, 1); assert.equal(stage.bookings[0].id, run.original.bookingId);
    assert.equal(stage.bookings[0].createdAtMillis, run.original.createdAtMillis); assert.equal(stage.bookings[0].seats, 2);
  }
  assert.equal(run.stages.afterApproval.seatsAvailable, 2);
  assert.equal(run.stages.afterCancellation.seatsAvailable, 4);
  assert.equal(run.stages.afterCancellation.bookings[0].status, 'cancelled');
  assert.equal(run.conflict.status, 409); assert.equal(run.conflict.code, 'ALREADY_EXISTS');
  assert.equal(run.races.passed, true); assert.equal(run.races.outcomes.length, 13);
  assert.equal(run.races.outcomes.filter((item) => item.id.startsWith('send-resolution-race-')).length, 8);
  assert(run.races.outcomes.filter((item) => item.id.startsWith('send-resolution-race-')).every((item) => item.consistent));
});
test('native data and process contracts do not become physical phone or iOS SDK claims', () => {
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + 'android-coordinator.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 10);
  for (const name of ['failures', 'errors', 'skipped']) assert.equal(Number(suite[`@_${name}`]), 0);
  const swift = json('swift-recovery.json');
  assert.equal(swift.passed, true); assert.equal(swift.cases.length, 14);
  assert.equal(swift.scope, 'foundation-booking-recovery-not-ios-ui');
  assert.equal(swift.separateProcessRecovery, true); assert.equal(swift.swiftLanguageVersion, 6);
  assert(swift.cases.every((item) => item.status === 'passed'));
  for (const [file, count] of [['functions.json', 238], ['rules.json', 20]]) {
    const run = json(file); assert.equal(run.success, true); assert.equal(run.numPassedTests, count); assert.equal(run.numFailedTests, 0);
  }
  for (const [file, count] of [['displayed-agreement.json', 25], ['transaction-consistency.json', 14]]) {
    const run = json(file); assert.equal(run.passed, true); assert.equal(run.cases.length, count);
    assert(run.cases.every((item) => item.status === 'passed'));
  }
  const services = json('services.json');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.steps.length, 24); assert(services.steps.every((item) => item.status === 'passed'));
  assert.equal(content.flows.find((item) => item.id === 'booking').status, 'partial');
  assert.equal(content.blockers.find((item) => item.id === 'booking-retry-devices').source, base + 'README.md');
});
test('CI requires fresh transport, storage and guarded native process stages', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-recovery-evidence.test.mjs"').length - 1, 2);
  for (const command of ['npm run test:booking-response-loss', 'npm run test:booking-recovery-wire',
    'node --test tests/booking-recovery-evidence.test.mjs', 'tests/booking-request-rules.test.ts']) assert(workflow.includes(command));
  assert(workflow.includes('name: booking-recovery-results'));
  const native = read('scripts/qa/local-android-session.mjs');
  assert(native.includes('await replayNativeBookingLoss')); assert(native.includes('testCount: 23'));
  const check = read('scripts/qa/local-native-booking-loss.mjs');
  for (const text of ['prepareUnconfirmedBooking', 'recoverUnconfirmedBooking', 'stopDisposableBookingProcess',
    'assert.equal(records.size, 1)', 'assert.notEqual(before.processId, after.processId)']) assert(check.includes(text));
  const stop = read('scripts/qa/local-booking-process-stop.mjs');
  for (const text of ["process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true'", 'session.runId, runId',
    'session.disposableEmulator, true']) assert(stop.includes(text));
});
