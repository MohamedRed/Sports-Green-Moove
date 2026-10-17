import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-booking-display-2026-10-17/';
const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const read = (path) => bytes(path).toString();
const json = (file) => JSON.parse(read(base + file));
const hashes = {
  'before.json': '6e5562e50bf2550a6a4e40b7fd3419238edccedc04caf7ffac0c286209c8e42f',
  'after.json': '636ae88470285b32956cd70d0bd6886da89b842e2ff0c4c4f26c67c6c71d7b36',
  'services-before.json': '697d144f0f6eb0b7dff8e08e72273831c2a14976d207ee76b8d9209b6b5ce8c7',
  'services-after.json': '7e3a3584a0f4c612d4837af68143da995d2df72994af53798f6fd6899a1f8edd',
  'consistency.json': 'd59b00ee97cf3210c88ace2388d88df0105920789e91a39755e11eb276d48689',
  'functions.json': '6007103bc8e8be49901566b243d23f0a6847b5fdbf6b333eec5ec1a71217bcd7',
  'swift-wire.json': '0d3b6a1e9b3abaf0d5466ea465ec22ad2c675a73b3dcf6dc0972a0b5c0cb6f37',
  'android-snapshot.xml': 'f9da28c361f0e6c8f9c342f003de43886f786447e1966b38d421001463b5e77c',
  'android-mapping.xml': '9dd851040ffaf7f24d5d43f874915af23b5ee83f245b1b5059ab400cbbbade7f',
  'android-payload.xml': '4ca7d02a41d7bffb976f9b36b2d9e5a39b25649bc141e5fd87c02d1e46fa1f68',
  'android-binding.xml': '48654031b46217c0f586f8a9437611610f96d4f974919aaf3ccbc8e569ddfa24',
};

test('original scoped receipts retain their bytes, including failures', () => {
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), hash, file);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(read(base + file)));
  }
  for (const file of ['before.json', 'after.json']) {
    const run = json(file);
    assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.scope, 'controlled-displayed-booking-intent-not-phone-ui');
    assert.equal(run.livePayment, false); assert.equal(run.productionDeployed, false);
    assert.equal(run.testedAt.slice(0, 10), '2026-10-17');
    assert.match(run.runId, /^[a-f0-9]{32}$/);
    assert.equal(Object.keys(run.sourceSha256).length, 3);
  }
});

test('the original handler really accepted stale and absent displayed snapshots', () => {
  const run = json('before.json');
  assert.equal(run.sourceRef, 'f130e9ebd17fc61810235bada56eae04992c91c1');
  assert.equal(run.runId, '9ab238c9128e5e3df60b347a942b4822');
  assert.equal(run.passed, false); assert.equal(run.cases.length, 22);
  assert.equal(run.cases.filter((item) => item.status === 'passed').length, 4);
  for (const item of run.cases.slice(0, 18)) {
    assert.equal(item.status, 'failed'); assert.equal(item.bookingCount, 1);
  }
});

test('the final 25 cases reject stale terms and retain deliberately reviewed terms', () => {
  const run = json('after.json');
  assert.equal(run.runId, '3d21ae2d233fce3234c5fdc4c4ae1ce0');
  assert.equal(run.passed, true); assert.equal(run.cases.length, 25);
  assert(run.cases.every((item) => item.status === 'passed'));
  assert.deepEqual(run.cases.slice(0, 22).map((item) => item.id), json('before.json').cases.map((item) => item.id));
  for (const item of run.cases) {
    if (item.expectedError) {
      assert.equal(item.rejected.code, item.expectedError); assert.equal(item.bookingCount, 0);
    } else {
      assert.equal(item.bookingCount, 1); assert.equal(item.saved[0].seats, 2);
      assert.equal(item.saved[0].agreedAmountCents, item.currentPriceCents * 2);
    }
  }
  const fresh = run.cases.find((item) => item.id === 'fresh-review');
  assert.equal(fresh.displayedIntent.terms.priceCents, 250);
  assert.equal(fresh.submittedIntent.terms.priceCents, 900); assert.equal(fresh.refreshed, true);
  assert.equal(fresh.saved[0].agreedAmountCents, 1800);
  for (const id of ['timestamp-document', 'date-document', 'equivalent-time-format']) {
    assert(run.cases.some((item) => item.id === id));
    assert(!json('before.json').cases.some((item) => item.id === id));
  }
});

test('date regression, corrected services and transaction-race coverage remain distinct', () => {
  const failed = json('services-before.json'), passed = json('services-after.json');
  assert.equal(failed.steps.length, 24);
  assert.deepEqual(failed.steps.filter((item) => item.status !== 'passed').map((item) => item.id),
    ['publication', 'multi-seat-booking', 'reservation-decisions', 'trip-cancellation']);
  assert.equal(passed.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(passed.steps.length, 24); assert(passed.steps.every((item) => item.status === 'passed'));
  const consistency = json('consistency.json');
  assert.equal(consistency.passed, true); assert.equal(consistency.cases.length, 14);
  assert(consistency.cases.every((item) => item.status === 'passed'));
  assert.equal(consistency.cases.at(-1).mutationResult.parentDecision, 'accept');
  const unit = json('functions.json');
  assert.equal(unit.success, true); assert.equal(unit.numPassedTests, 233); assert.equal(unit.numFailedTests, 0);
});

test('native receipts are JVM and Foundation checks, not promoted to phone UI evidence', () => {
  for (const [file, count] of [['android-snapshot.xml', 4], ['android-mapping.xml', 4],
    ['android-payload.xml', 5], ['android-binding.xml', 7]]) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + file)).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite[`@_${key}`]), 0);
  }
  const swift = json('swift-wire.json');
  assert.equal(swift.scope, 'foundation-wire-contract-not-ios-ui');
  assert.equal(swift.passed, true); assert.equal(swift.cases.length, 15);
  assert(swift.cases.every((item) => item.status === 'passed'));
  assert.equal(content.flows.find((item) => item.id === 'booking').status, 'partial');
  assert(content.updates.some((item) => item.flow === 'booking' && /25 contrôles locaux/.test(item.text)));
  assert.equal(content.blockers.find((item) => item.id === 'booking-retry-devices').source,
    'docs/release/evidence/local-booking-recovery-2026-10-17/README.md');
});

test('smoke CI executes fresh handler and wire checks without weakening native gates', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-display-evidence.test.mjs"').length - 1, 2);
  for (const command of ['node --test tests/booking-display-evidence.test.mjs',
    'npm run test:booking-display', 'npm run test:booking-intent-wire']) assert(workflow.includes(command));
  assert(workflow.includes('name: booking-display-results'));
  const backend = read('functions/src/domain/bookingRequestIdentity.ts');
  assert.match(backend, /expectedBookingIntent: bookingIntentSnapshotSchema/);
  assert(!backend.includes('expectedBookingIntent: bookingIntentSnapshotSchema.optional'));
  assert(read('scripts/qa/check-booking-intent-wire.mjs').includes("'-swift-version', '6'"));
});
