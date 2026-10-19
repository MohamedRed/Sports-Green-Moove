import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateRideObservationReport, validateRetainedRideObservation } from '../scripts/qa/ride-observation-retained-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

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
  assert.equal(flow.status, 'partial'); assert.equal(flow.ui.source, source); assert.equal(flow.images.length, 11);
  assert.equal(flow.images.at(-1).file, 'vehicle-map-unverified');
  assert.match(flow.images.at(-1).alt, /arrêté avant de vérifier le déplacement/);
  assert.equal(flow.tour.length, 10); assert.match(flow.remaining, /vraies positions.*téléphone/);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
  assert.doesNotMatch(JSON.stringify(flow), /BrowserStack|Firebase|Android|SDK|emulator/i);
});
