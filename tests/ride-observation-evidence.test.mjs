import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateRideObservationReport, validateRetainedRideObservation } from '../scripts/qa/ride-observation-retained-evidence.mjs';
import { content } from '../partner-portal/content.mjs';
import { validateRideObservationRecheck } from '../scripts/qa/ride-observation-recheck-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'docs/release/evidence/ride-observation-native-2026-10-19/ride-observation-results.json';
const report = JSON.parse(readFileSync(resolve(root, source)));
test('original standalone native pass retains primary transfer, source bytes and actual ordered states', () => {
  assert.equal(validateRetainedRideObservation(root, source).runId, report.runId);
  assert.equal(report.staleWaitElapsedMs, 90725);
});
test('local observation cannot accept provider, physical, map, network, safety or store requirements', () => {
  for (const key of ['physicalDevice', 'productionWrites', 'providerTrackingVerified', 'mapMovementVerified',
    'realNetworkLossVerified', 'safetyAuditAccepted', 'storeReviewAccepted']) {
    assert.throws(() => validateRideObservationReport({ ...report, [key]: true }), undefined, key);
  }
  for (const key of ['adminClientClosed', 'isolatedFixtureCleanupVerified', 'nativeUiExecuted'])
    assert.throws(() => validateRideObservationReport({ ...report, [key]: false }));
});
test('elapsed aging, real stored completion and a primary transfer are required', () => {
  for (const patch of [{ staleWaitElapsedMs: 0 }, { staleWaitElapsedMs: 80_000 }, { primaryEvidencePhase: 'failure-cleanup' },
    { stored: { ...report.stored, completionVerified: false } }, { nativeCaseCount: 0 }])
    assert.throws(() => validateRideObservationReport({ ...report, ...patch }));
});
test('an altered native transcript, marker, receipt or capture cannot be promoted by a positive summary', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'sgm-observation-tamper-'));
  try {
    cpSync(resolve(root, 'docs'), resolve(folder, 'docs'), { recursive: true, filter: (path) =>
      !path.includes('/evidence/') || path.includes('/source-archive') || path.includes('/ride-observation-native-2026-10-19') || path.endsWith('/evidence') });
    const base = resolve(folder, source, '..');
    for (const file of ['LocalRideObservationFlowTest-instrumentation.txt', 'local-ride-observation-device.json',
      'adb-pull-ride-observation.json', 'local-ride-observation-stale.png', 'functions-unit.xml', 'checks.json']) {
      const original = readFileSync(resolve(base, file));
      writeFileSync(resolve(base, file), 'tampered');
      assert.throws(() => validateRetainedRideObservation(folder, source), undefined, file);
      writeFileSync(resolve(base, file), original);
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('the portal keeps observation separate from untested physical tracking with all eight reviewed states', () => {
  const flow = content.flows.find((item) => item.id === 'ride-observation');
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, source); assert.equal(flow.images.length, 18);
  assert.equal(flow.images.at(-1).file, 'vehicle-map-unverified');
  assert.match(flow.images.at(-1).alt, /arrêté avant de vérifier le déplacement/);
  assert.equal(flow.tour.length, 9); assert.match(flow.remaining, /vraies positions.*téléphone/);
  assert.equal(flow.checkedAt, '2026-10-21'); assert.equal(flow.ui.checkedAt, '2026-10-19');
  assert.equal(flow.mapUi.checkedAt, '2026-10-19'); assert.equal(flow.local.checkedAt, '2026-10-19');
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'blocked');
  assert.doesNotMatch(JSON.stringify(flow), /BrowserStack|Firebase|Android|SDK|emulator/i);
});

const recheckSource = 'docs/release/evidence/ride-observation-native-2026-10-21/ride-observation-results.json';
test('later native observation binds terminal job, original artifact, stored results and independent restoration', () => {
  const run = validateRideObservationRecheck(root, recheckSource);
  assert.equal(run.staleWaitElapsedMs, 89943); assert.equal(Object.keys(run.publishedCaptures).length, 7);
  const flow = content.flows.find(item => item.id === 'ride-observation');
  assert.equal(flow.observationRecheck.source, recheckSource);
  assert.deepEqual(flow.tour.slice(2).map(step => step.image), Object.keys(run.publishedCaptures));
  assert(!flow.images.some(image => image.file === 'ride-recheck-fresh-landscape'));
});
test('a positive recheck cannot override raw captures, cleanup, job or bounded verification scope', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'sgm-observation-recheck-'));
  try {
    const base = resolve(folder, recheckSource, '..');
    cpSync(resolve(root, recheckSource, '..'), base, { recursive: true });
    const archives = resolve(folder, 'docs/release/evidence/source-archive'); mkdirSync(archives, { recursive: true });
    const report = JSON.parse(readFileSync(resolve(root, recheckSource)));
    for (const hash of Object.values(report.sourceFiles))
      cpSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'), resolve(archives, hash + '.txt'));
    for (const file of ['local-ride-observation-stale.png', 'LocalRideObservationFlowTest-instrumentation.txt',
      'disposable-device-restore.json', 'job.json', 'original-artifact.zip', 'artifact.json']) {
      const original = readFileSync(resolve(base, file)); writeFileSync(resolve(base, file), 'tampered');
      assert.throws(() => validateRideObservationRecheck(folder, recheckSource), undefined, file);
      writeFileSync(resolve(base, file), original);
    }
    const contextPath = resolve(base, 'retained-context.json'), original = readFileSync(contextPath);
    const context = JSON.parse(original);
    for (const key of ['physicalDevice', 'mapMovementVerified', 'realNetworkLossVerified', 'providerTrackingVerified',
      'fullNativeSuiteVerified', 'safetyAuditAccepted', 'storeReviewAccepted', 'productionWrites']) {
      writeFileSync(contextPath, JSON.stringify({ ...context, [key]: true }));
      assert.throws(() => validateRideObservationRecheck(folder, recheckSource), undefined, key);
    }
    writeFileSync(contextPath, original); validateRideObservationRecheck(folder, recheckSource);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
