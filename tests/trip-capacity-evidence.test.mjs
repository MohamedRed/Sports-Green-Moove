import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-capacity-2026-10-16/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('the new local scenario reproduces the unauthorized driver write before the rule fix', () => {
  const before = json('services-before.json');
  assert.equal(before.projectId, 'demo-sgm-local-qa');
  assert.equal(before.runId, '120b63a303021ee4d38f33e9d769d6f2');
  assert.equal(before.steps.length, 17);
  assert.equal(before.steps.filter((step) => step.status === 'passed').length, 16);
  const failure = before.steps.find((step) => step.id === 'trip-capacity-ownership');
  assert.equal(failure.status, 'failed');
  assert.match(failure.message, /seatsAvailable must be denied/);
  assert.match(failure.message, /200 !== 403/);
  assert.match(read(base + 'rules-before.xml'), /tests="10" failures="9" errors="0"/);
});

test('published capacity checks require real local actors, denial checks and preserved booking accounting', () => {
  const run = json('services-after.json');
  assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.runId, '7aeb2b90da53b0cc1032b6ac7fcb0ded');
  assert.equal(run.steps.length, 17);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(run.tripCapacity, { requestedSeats: 2, seatsAfterApproval: 2,
    rejectedOwnerMutations: 7, rejectedOtherActors: 3, titleEditAllowed: true,
    seatsAfterCancellation: 4, repeatedCancellationRejected: true,
    method: 'authenticated-local-firestore-and-callable-with-persisted-checks', livePayment: false, nativeUi: false });
  assert.match(read(base + 'rules-after.xml'), /tests="26" failures="0" errors="0"/);
  assert.match(read(base + 'rules-after.xml'), /name="tests\/trip-capacity-rules.test.ts"[^>]*tests="10" failures="0"/);
  const flow = content.flows.find((item) => item.id === 'booking');
  assert.equal(flow.local.source, base + 'services-after.json');
  assert(flow.local.groups.includes('trip-capacity-ownership'));
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /remboursements/);
  assert.equal(flow.ui.source, 'docs/release/evidence/local-reservations-2026-10-16/ui-results.json');
  assert.match(read(base + 'README.md'), /not been deployed to production/);
});

test('CI keeps the capacity boundary and all prior service scenarios mandatory', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:rules'].includes('tests/trip-capacity-rules.test.ts'));
  const runner = read('scripts/qa/run-local-flows.mjs');
  assert.match(runner, /result.steps.length, 17/);
  assert.match(runner, /result.tripCapacity\?\.rejectedOwnerMutations, 7/);
  assert.match(runner, /result.tripCapacity\?\.seatsAfterCancellation, 4/);
  assert.match(read('scripts/qa/local-flow-suite.mjs'), /check\('trip-capacity-ownership'/);
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(smoke.split('tests/trip-capacity-evidence.test.mjs').length - 1, 3);
  assert.equal(smoke.split('tests/trip-capacity-rules.test.ts').length - 1, 2);
});
