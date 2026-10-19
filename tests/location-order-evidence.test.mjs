import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const base = 'docs/release/evidence/location-order-2026-10-19/';
const json = (file) => JSON.parse(text(base + file));
const report = json('results.json'), services = json('services.json');
const checkIds = [
  'delayed-native-point-cannot-replace-newer-observation',
  'same-time-duplicate-does-not-change-location-or-receipt-time',
  'concurrent-native-requests-retain-the-greatest-observation-time',
  'participant-parent-still-receives-the-current-observation-age',
  'unauthorized-parent-write-remains-denied-without-changing-location',
  'native-and-webhook-writer-share-one-monotonic-register',
  'delayed-provider-event-retains-audit-without-rewinding-location',
  'each-child-register-and-vehicle-register-are-independent',
  'invalid-or-future-provider-times-cannot-poison-current-register',
  'older-batch-counts-only-committed-points-as-written',
];

test('the original failed native replay proves a stored position actually moved backwards', () => {
  const failure = json('before-failure.json');
  assert.equal(failure.scope, 'diagnostic-failed-location-order-replay-not-acceptance');
  assert.equal(failure.accepted, false); assert.equal(report.before.accepted, false);
  assert.equal(failure.projectId, 'demo-sgm-local-qa'); assert.equal(failure.runId, report.before.runId);
  assert(failure.observed.afterDelayedPoint.capturedAt < failure.observed.expectedCapturedAt);
  assert.equal(failure.observed.afterDelayedPoint.userId, 'sgm-qa-driver');
  assert.match(failure.failure, /A delayed upload must not replace a newer stored observation/);
  assert(text(base + 'before.txt').includes('Script exited unsuccessfully (code 1)'));
  assertRetainedSourceFiles(root, report.before.sourceFiles);
  const previous = text('docs/release/evidence/source-archive/' + report.before.sourceFiles['functions/src/lib/liveTrips.ts'] + '.txt');
  assert(previous.includes('.set(liveLocationPayload(update))'));
});

test('only the completed ten-group service run proves local monotonic writes and retained audit processing', () => {
  assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.method, 'actual-authenticated-callables-and-shared-admin-writer');
  assert.equal(services.runId, report.after.runId); assert.notEqual(services.runId, report.before.runId);
  assert.deepEqual(services.checks, checkIds.map((id) => ({ id, status: 'passed' })));
  assert.deepEqual(services.steps, [{ id: 'location-order', status: 'passed' }]);
  assert.equal(services.concurrentRequestCount, 12); assert.equal(services.testCount, 1);
  assert.equal(services.adminClientClosed, true); assert.equal(report.after.serviceGroups, 10);
  assert(text(base + 'services.txt').includes('Script exited successfully (code 0)'));
  for (const emulator of ['Functions', 'Database', 'Firestore', 'Auth'])
    assert(text(base + 'services.txt').includes('Stopping ' + (emulator === 'Auth' ? 'Authentication' : emulator) + ' Emulator'));
  assertRetainedSourceFiles(root, services.sourceFiles); assertRetainedSourceFiles(root, report.after.sourceFiles);
});

test('338 original function cases pass, including the twenty ordering policy cases', () => {
  const suites = new XMLParser({ ignoreAttributes: false }).parse(text(base + 'full-functions.xml')).testsuites;
  assert.equal(Number(suites['@_tests']), 338); assert.equal(Number(suites['@_failures']), 0); assert.equal(Number(suites['@_errors']), 0);
  const ordering = suites.testsuite.find((suite) => suite['@_name'] === 'src/__tests__/live-location-order.test.ts');
  assert.equal(Number(ordering['@_tests']), 20); assert.equal(Number(ordering['@_failures']), 0);
  assert.equal(report.after.unitCases, 338); assert.equal(report.after.failures, 0);
});

test('retained artifacts cannot turn local administrative checks into physical, provider or release proof', () => {
  assert.equal(report.scope, 'monotonic-location-unit-and-local-services-not-ui');
  for (const result of [report, services]) for (const key of [
    'nativeUiExecuted', 'physicalDevice', 'productionWrites', 'providerWebhookDelivery', 'auditAcceptance',
  ]) assert.equal(result[key], false);
  assert.equal(services.providerRequests, 0); assert.equal(report.storeReviewAccepted, false);
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    const bytes = readFileSync(new URL('../' + base + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY/);
  }
});

test('the current writer is atomic and reports actual commits without losing event reconciliation', () => {
  const writer = text('functions/src/lib/liveTrips.ts');
  assert(writer.includes('.transaction(')); assert(writer.includes('shouldReplaceLiveLocation(current, update, Date.now())'));
  assert(writer.includes('return result.committed')); assert(!writer.includes('.set(liveLocationPayload'));
  assert(text('functions/src/callables/locations.ts').includes('ignored: results.length - written'));
  const reconciler = text('functions/src/services/radarReconciliation.ts');
  assert(reconciler.includes('const locationWritten = update ? await writeLiveLocation(update) : false'));
  assert(reconciler.includes('if (signal) await writeRadarRideSignal(signal)'));
  const harness = text('scripts/qa/local-location-order.mjs');
  assert(harness.indexOf('finally { await deleteApp(getApp()); }') < harness.lastIndexOf('writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT'));
  assert(!harness.includes('process.exit('));
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = text('.github/workflows/' + name);
    assert(workflow.includes('npm run test:location-order')); assert(workflow.includes('tests/location-order-evidence.test.mjs'));
  }
});

test('the partner site still requires actual live screen and physical-device verification', () => {
  const flow = content.flows.find((item) => item.id === 'tracking');
  assert.equal(flow.status, 'untested'); assert.equal(flow.ui, undefined); assert.equal(flow.phone, undefined);
  assert.equal(flow.local, undefined); assert.deepEqual(flow.images, []);
  assert.match(flow.verified, /sur les données, pas sur un trajet réel/);
  assert.match(flow.remaining, /affichage en direct/); assert.match(flow.remaining, /pertes GPS\/réseau/);
  assert(text(flow.source).includes('../location-order-2026-10-19'));
});

const reevaluationBase = 'docs/release/evidence/location-order-reevaluation-2026-10-19/';
const reevaluation = JSON.parse(text(reevaluationBase + 'results.json'));
test('a reproduced transaction-clock race stays negative and the final writer reevaluates time', () => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const before = parser.parse(text(reevaluationBase + 'before-unit.xml')).testsuites;
  assert.equal(Number(before['@_tests']), 3); assert.equal(Number(before['@_failures']), 1);
  assert.equal(reevaluation.before.failures, 1); assertRetainedSourceFiles(root, reevaluation.before.sourceFiles);
  const after = parser.parse(text(reevaluationBase + 'full-functions.xml')).testsuites;
  assert.equal(Number(after['@_tests']), 341); assert.equal(Number(after['@_failures']), 0); assert.equal(Number(after['@_errors']), 0);
  const writerCases = after.testsuite.find((suite) => suite['@_name'] === 'src/__tests__/live-trips-write.test.ts');
  assert.equal(Number(writerCases['@_tests']), 3); assert.equal(Number(writerCases['@_failures']), 0);
  assert.equal(reevaluation.after.unitCases, 341); assert.equal(reevaluation.after.failures, 0);
  assertRetainedSourceFiles(root, reevaluation.after.sourceFiles);
  assert.equal(createHash('sha256').update(text('functions/src/lib/liveTrips.ts')).digest('hex'),
    reevaluation.after.sourceFiles['functions/src/lib/liveTrips.ts']);
  assert.notEqual(reevaluation.before.sourceFiles['functions/src/lib/liveTrips.ts'], reevaluation.after.sourceFiles['functions/src/lib/liveTrips.ts']);
});
test('the final-source ten-group replay is a distinct completed run, not inherited from the earlier repair', () => {
  const current = JSON.parse(text(reevaluationBase + 'services.json'));
  assert.equal(current.scope, services.scope); assert.equal(current.projectId, 'demo-sgm-local-qa');
  assert.equal(current.method, services.method); assert.equal(current.runId, reevaluation.after.runId);
  assert.notEqual(current.runId, services.runId); assert.equal(current.adminClientClosed, true);
  assert.deepEqual(current.checks, services.checks); assert.equal(current.concurrentRequestCount, 12);
  assert.deepEqual(current.steps, services.steps); assertRetainedSourceFiles(root, current.sourceFiles);
  assert.equal(current.sourceFiles['functions/src/lib/liveTrips.ts'], reevaluation.after.sourceFiles['functions/src/lib/liveTrips.ts']);
  assert(text(reevaluationBase + 'services.txt').includes('Script exited successfully (code 0)'));
  assert(text(reevaluationBase + 'services.txt').includes('Stopping Database Emulator'));
  for (const outcome of [reevaluation, current]) for (const key of [
    'nativeUiExecuted', 'physicalDevice', 'productionWrites', 'providerWebhookDelivery', 'auditAcceptance',
  ]) assert.equal(outcome[key], false);
  assert.equal(reevaluation.storeReviewAccepted, false);
  for (const [file, expected] of Object.entries(JSON.parse(text(reevaluationBase + 'artifact-sha256.json')))) {
    const bytes = readFileSync(new URL('../' + reevaluationBase + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY/);
  }
});
