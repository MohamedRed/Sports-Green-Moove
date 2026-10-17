import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-details-2026-10-16/';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (name) => JSON.parse(read(base + name));

test('original rules reproduce all 28 unsafe operational writes while preserving five existing policies', () => {
  const before = json('sgm-trip-details-rules-before.json');
  const after = json('sgm-trip-details-rules-after.json');
  assert.equal(before.numTotalTests, 33); assert.equal(before.numPassedTests, 5);
  assert.equal(before.numFailedTests, 28); assert.equal(before.success, false);
  assert.equal(after.numTotalTests, 82); assert.equal(after.numPassedTests, 82);
  assert.equal(after.numFailedTests, 0); assert.equal(after.success, true);
  for (const run of [before, after]) assert.equal(new Date(run.startTime).toISOString().slice(0, 10), '2026-10-16');
  const oldCases = before.testResults[0].assertionResults;
  const newCases = after.testResults.find((suite) => suite.name.endsWith('/tests/trip-details-rules.test.ts')).assertionResults;
  assert.equal(newCases.length, 33);
  assert.deepEqual(newCases.map((item) => item.fullName), oldCases.map((item) => item.fullName));
  assert(newCases.every((item) => item.status === 'passed'));
  assert.equal(oldCases.filter((item) => item.status === 'failed' && item.fullName.includes('operational mutation')).length, 23);
  assert.equal(oldCases.filter((item) => item.status === 'failed' && item.fullName.includes('removing')).length, 4);
  assert(oldCases.some((item) => item.status === 'failed' && item.fullName.includes('bundled')));
  for (const name of ['cosmetic title edit', 'administrator policy'])
    assert(oldCases.some((item) => item.status === 'passed' && item.fullName.includes(name)));
  assert(after.testResults.every((suite) => suite.status === 'passed'));
});

test('signed-in transport reproduces the bypass then verifies every denial against complete saved documents', () => {
  const before = json('sgm-trip-details-services-before.json');
  const after = json('sgm-trip-details-services-after.json');
  assert.equal(before.runId, '959fe2f396e36f832ae0438bb5fae93c');
  assert.equal(before.steps.length, 21); assert.equal(before.steps.filter((step) => step.status === 'passed').length, 20);
  const failure = before.steps.find((step) => step.id === 'trip-details-ownership');
  assert.equal(failure.status, 'failed'); assert.match(failure.message, /driver-price-change must be denied/);
  assert.match(failure.message, /200 !== 403/);
  assert.equal(after.runId, '22e1a2d2d04de02588158606ab0ff206');
  assert.equal(after.testedAt, '2026-10-16T18:48:30.809Z');
  assert.equal(after.projectId, 'demo-sgm-local-qa'); assert.equal(after.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(after.steps.length, 21); assert(after.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(after.steps.map((step) => step.id), before.steps.map((step) => step.id));
  const details = after.tripDetails;
  assert.equal(details.method, 'authenticated-local-firestore-rest-with-independent-persisted-checks');
  assert.equal(details.deniedOwnerMutations, 14); assert.equal(details.deniedOtherActors, 3);
  assert.equal(details.attempts.length, 17); assert.equal(details.titleEditAllowed, true);
  assert(details.attempts.every((item) => item.status === 403 && item.tripUnchanged && item.bookingUnchanged));
  assert(details.attempts.some((item) => item.kind === 'driver-atomic-commit-price-change'));
  assert(details.attempts.some((item) => item.kind === 'driver-future-field-injection'));
  assert.equal(details.attempts.filter((item) => item.kind.startsWith('driver-remove-')).length, 3);
  assert.deepEqual(details.savedBooking, { status: 'approved', paymentStatus: 'paid', seats: 2 });
  const trip = details.savedTrip;
  assert.equal(trip.title, 'Trip details cosmetic title QA'); assert.equal(trip.status, 'published');
  assert.equal(trip.priceCents, 250); assert.equal(trip.seatsAvailable, 2); assert.equal(trip.seatsTotal, 4);
  assert.deepEqual(trip.origin, { lat: 50.7167, lng: 4.6167 });
  assert.deepEqual(trip.destination, { lat: 50.8503, lng: 4.3517 });
  assert.equal(trip.supportsChildTracking, true); assert.equal(trip.supportsVehicleTracking, true);
  assert.equal(details.syntheticPaymentMetadata, true);
  for (const key of ['nativeUi', 'operationalEditingImplemented', 'reconfirmationPolicyApproved', 'livePayment', 'productionDeployed'])
    assert.equal(details[key], false);
  const source = read('scripts/qa/local-trip-details.mjs');
  assert.match(source, /deepEqual\(await document\('trips', tripId\), original/);
  assert.match(source, /deepEqual\(await document\('bookings', bookingId\), originalBooking/);
  assert.match(source, /response.body.error\?\.status, 'PERMISSION_DENIED'/);
  assert.match(source, /parentReconfirmationImplemented: false/);
  assert(!source.includes('reconfirmationPolicyApproved: false'));
});

test('raw reports remain byte exact and the portal keeps full editing and real settlement open', () => {
  const hashes = json('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 4);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256')
    .update(readFileSync(new URL(base + name, root))).digest('hex'), hash, name);
  const flow = content.flows.find((item) => item.id === 'publication');
  const current = 'docs/release/evidence/local-trip-change-native-2026-10-17/';
  assert.equal(flow.status, 'partial');
  assert.equal(flow.source, 'docs/release/evidence/local-trip-change-inputs-native-2026-10-17/README.md');
  assert.equal(flow.local.source, current + 'services.json');
  assert(flow.local.groups.includes('trip-details-ownership'));
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-change-inputs-native-2026-10-17/completed/results.json');
  assert.match(flow.remaining, /la date.*parcours.*application/); assert.match(flow.remaining, /remboursements réels/);
  assert.match(flow.remaining, /téléphone/); assert.match(flow.remaining, /pas en ligne/);
  const blocker = content.blockers.find((item) => item.id === 'trip-management');
  assert.match(blocker.next, /confirmation entre comptes/); assert.match(blocker.next, /paiements concernés/);
  assert(!blocker.next.includes('Choisir entre'));
  assert(content.updates.some((item) => item.date === '2026-10-16' && item.flow === 'publication' && /détails réservés/.test(item.title)));
  assert.match(read(base + 'README.md'), /not been deployed to production/);
  const contract = read('docs/contracts/trip-editing.md');
  assert.match(contract, /owner explicitly selected \*\*fresh parent confirmation\*\*/);
  assert.match(contract, /complete editing\s+flow is not yet verified end to end/);
  assert.match(contract, /Android editing and parent-review screens\s+are implemented/);
  assert.match(contract, /declined change\s+into a cancellation/);
  assert(content.updates.some((item) => item.flow === 'publication' && /parents confirmeront/.test(item.title) && /reste à construire/.test(item.text)));
});

test('CI keeps new rules and evidence checks mandatory alongside the complete service suite', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:rules'].includes('tests/trip-details-rules.test.ts'));
  assert(pkg.scripts['test:trip-details-rules'].includes('tests/trip-details-rules.test.ts'));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-details-rules.test.ts"').length - 1, 2);
  assert.equal(workflow.split('"tests/trip-details-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: npm run test:trip-details-rules'));
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/trip-details-evidence\.test\.mjs(?:\s|$)/m);
  assert.match(read('scripts/qa/local-flow-suite.mjs'), /check\('trip-details-ownership'/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.steps.length, 24/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.tripDetails\?\.deniedOwnerMutations, 14/);
  const rules = read('firestore.rules');
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['title'\]\)/);
  assert(!rules.includes('tripProtectedFields'));
});
