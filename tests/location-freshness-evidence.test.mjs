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
const base = 'docs/release/evidence/location-freshness-2026-10-19/';
const report = JSON.parse(text(base + 'results.json')), services = JSON.parse(text(base + 'services.json'));
const parser = new XMLParser({ ignoreAttributes: false });
test('original negative and repaired unit runs retain their real outcomes and exact source bytes', () => {
  assert.equal(report.scope, 'unit-and-local-callable-freshness-not-native-or-physical-gps');
  for (const [name, expected] of [['before.xml', [10, 9]], ['after.xml', [20, 0]], ['full-functions.xml', [318, 0]]]) {
    const suite = parser.parse(text(base + name)).testsuites;
    assert.equal(Number(suite['@_tests']), expected[0]); assert.equal(Number(suite['@_failures']), expected[1]);
    assert.equal(Number(suite['@_errors']), 0);
  }
  for (const phase of [report.before, report.after]) assertRetainedSourceFiles(root, phase.sourceFiles);
  assert.equal(report.before.failures, 9); assert.equal(report.after.failures, 0);
});
test('only the independently completed actual callable run supplies the five passing service checks', () => {
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.method, 'actual-authenticated-location-callables'); assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.runId, '91e969aa7e7bcf8993c83301396a9d50'); assert.equal(services.runId, report.services.runId);
  assert.equal(services.adminClientClosed, true); assert.equal(services.checks.length, 5);
  assert(services.checks.every((check) => check.status === 'passed'));
  assert.deepEqual(services.steps, [{ id: 'location-freshness', status: 'passed' }]);
  assert.equal(services.delayedObservation.capturedAgeAtSubmissionMs, 120_000);
  assert.equal(services.delayedObservation.parentStale, true); assert.equal(services.delayedObservation.parentLabel, 'Secours GPS · il y a 2 min');
  assert.equal(services.freshObservation.parentStale, false);
  assert(text(base + 'services.txt').includes('Script exited successfully (code 0)'));
  assert(text(base + 'services.txt').includes('Stopping Database Emulator'));
  assertRetainedSourceFiles(root, services.sourceFiles);
  for (const result of [services, report]) for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(result[key], false);
  assert.equal(services.providerRequests, 0); assert.equal(report.storeReviewAccepted, false);
});
test('the initial open-client attempt cannot be promoted into a completed run', () => {
  const initial = JSON.parse(text(base + 'initial-unclosed-client.json'));
  assert.equal(initial.runId, report.initialHarness.runId); assert.notEqual(initial.runId, services.runId);
  assert.equal(report.initialHarness.accepted, false); assert.equal(report.initialHarness.scriptWasTerminated, true);
  assert.equal(initial.adminClientClosed, undefined); assert.equal(initial.steps, undefined);
  assertRetainedSourceFiles(root, initial.sourceFiles);
});
test('retained hashes and current integration prevent receipt timestamps from manufacturing freshness', () => {
  for (const [file, hash] of Object.entries(JSON.parse(text(base + 'artifact-sha256.json')))) {
    const bytes = readFileSync(new URL('../' + base + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY/);
  }
  const formatter = text('functions/src/lib/clientTrips.ts');
  assert(!formatter.includes('location.uploadedAt ?? location.capturedAt'));
  assert(formatter.includes('timestamp > now')); assert(formatter.includes('age == null ? "Position à vérifier"'));
  assert(!text('functions/src/domain/locations.ts').includes('update.uploadedAt ??'));
  const harness = text('scripts/qa/local-location-freshness.mjs');
  assert(harness.indexOf('finally { await deleteApp(getApp()); }') < harness.indexOf('writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT'));
  assert(!harness.includes('process.exit('));
});
test('portal separates later simulated phone movement from historical data checks and real travel', () => {
  const flow = content.flows.find((flow) => flow.id === 'tracking');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.source, 'docs/release/evidence/tracking-clock-replay-2026-10-25/README.md');
  assert.equal(flow.local, undefined); assert.equal(flow.ui, undefined); assert.equal(flow.phone, undefined);
  assert.match(flow.verified, /aucun trajet réel/);
  assert.equal(flow.trackingPhoneAttempt.checkedAt, '2026-10-25');
  assert.match(flow.remaining, /affichage en direct/); assert.match(flow.remaining, /alertes de position/);
  for (const workflow of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const source = text('.github/workflows/' + workflow);
    assert(source.includes('npm run test:location-freshness')); assert(source.includes('tests/location-freshness-evidence.test.mjs'));
  }
  assert.equal((text('.github/workflows/native-ci.yml').match(/- "functions\/\*\*"/g) ?? []).length, 2);
  const budget = JSON.parse(text(base + 'ci-time-budget.json'));
  assert.equal(budget.accepted, false); assert.equal(budget.conclusion, 'cancelled');
  assert(budget.annotations.includes('The job has exceeded the maximum execution time of 15m0s'));
  assert(budget.skippedSteps.includes('Build Website'));
  assert(text('.github/workflows/web-integration-smoke.yml').includes('timeout-minutes: 30'));
});
