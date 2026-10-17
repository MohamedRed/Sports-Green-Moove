import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-booking-consistency-2026-10-17/';
const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const read = (path) => bytes(path).toString();
const json = (file) => JSON.parse(read(base + file));
const hashes = {
  'before.json': '2dead076384b3eea937dc1536f7eab2a4a5cc20ee7c8ff92cb4947e8be097a6c',
  'after.json': '2d4eb9032cd6a1535a33aa1ac7e82d89f12967afd1bf037e4719f7dd57f81766',
  'functions.json': '7529bad4660c165aba8e3fe049007f1b563b9fa1bdbfc0d3f94cf8c737ebd8a6',
  'search-recovery.xml': 'ab9220a7e75cdd8304fc1488fc47c669c60169077357e2bef5996247c095ec14',
  'error-policy.xml': '88fe955fb4627b0c5a7921426c34e6c04292da77bc4c63d89a6feb3645ca28ff',
  'services.json': '391c9040ff793b46eb4a8cb21be692b44ab7d11bb8ab4ea1549b00463e38e9b0',
};

test('retained booking evidence preserves original bytes and isolated scope', () => {
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(base + file)).digest('hex'), hash, file);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[\w-]{30}|sk_live_[\w]+|Bearer eyJ/.test(read(base + file)));
  }
  for (const file of ['before.json', 'after.json']) {
    const run = json(file);
    assert.equal(run.projectId, 'demo-sgm-local-qa');
    assert.equal(run.scope, 'controlled-local-booking-handler-not-phone-ui');
    assert.equal(run.livePayment, false); assert.equal(run.productionDeployed, false);
    assert.match(run.runId, /^[a-f0-9]{32}$/);
    assert.equal(run.testedAt.slice(0, 10), '2026-10-17');
  }
});

test('the original thirteen-case failure remains a failure, not retroactively accepted', () => {
  const run = json('before.json');
  assert.equal(run.passed, false); assert.equal(run.cases.length, 13);
  assert.equal(run.cases.filter((item) => item.status === 'passed').length, 3);
  for (const item of run.cases.slice(0, 8)) {
    assert.equal(item.status, 'failed'); assert.equal(item.bookingCount, 1);
  }
  assert(!run.cases.some((item) => item.id === 'confirmed-application'));
});

test('the final fourteen cases reject changed agreement or authority without creating a stale request', () => {
  const run = json('after.json');
  assert.equal(run.passed, true); assert.equal(run.cases.length, 14);
  assert.equal(run.runId, 'e85c1073a713f312d297bf7b43fe0a76');
  assert(run.cases.every((item) => item.status === 'passed' && item.mutationApplied));
  assert.deepEqual(run.cases.slice(0, 13).map((item) => item.id), json('before.json').cases.map((item) => item.id));
  for (const item of run.cases) {
    if (item.expectedError) {
      assert.equal(item.rejected.code, item.expectedError); assert.equal(item.bookingCount, 0);
    } else {
      assert.equal(item.bookingCount, 1); assert.equal(item.bookings[0].status, 'requested');
      assert(item.reads.some((path) => path.startsWith('children/')));
    }
  }
  const application = run.cases.at(-1).mutationResult;
  assert.equal(application.method, 'real-local-proposal-confirmation-application');
  assert.equal(application.parentDecision, 'accept'); assert.equal(application.status, 'applied');
  assert.equal(application.newPriceCents, 900); assert.equal(application.providerCalls, 1);
  assert.deepEqual(application.affectedBookingIds, [application.existingBookingId]);
  assert.equal(application.syntheticRoute, true); assert.equal(application.livePayment, false);
});

test('unit and wider service receipts retain their exact passing scope', () => {
  const unit = json('functions.json');
  assert.equal(unit.success, true); assert.equal(unit.numTotalTests, 228);
  assert.equal(unit.numPassedTests, 228); assert.equal(unit.numFailedTests, 0);
  for (const file of ['search-recovery.xml', 'error-policy.xml']) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(base + file)).testsuite;
    assert.equal(Number(suite['@_tests']), 4); assert.equal(Number(suite['@_failures']), 0);
    assert.equal(Number(suite['@_skipped']), 0); assert.equal(Number(suite['@_errors']), 0);
  }
  const services = json('services.json');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.steps.length, 24); assert(services.steps.every((item) => item.status === 'passed'));
});

test('smoke CI covers the harness and Android recovery while release status remains partial', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/booking-consistency-evidence.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: npm run test:booking-consistency/);
  assert.match(workflow, /run: node --test tests\/booking-consistency-evidence.test.mjs/);
  assert(workflow.includes('name: booking-consistency-results'));
  const collector = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  for (const name of ['booking-review-required.png', 'booking-review-narrow.png']) assert(collector.includes(name));
  assert.equal(content.flows.find((item) => item.id === 'booking').status, 'partial');
  assert.equal(content.blockers.find((item) => item.id === 'booking-review').source, base + 'README.md');
  assert.match(read(base + 'README.md'), /does not bind a request to the terms previously displayed/);
});
