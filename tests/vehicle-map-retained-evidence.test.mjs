import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateRetainedVehicleMapDisplay } from '../scripts/qa/vehicle-map-retained-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'docs/release/evidence/vehicle-map-display-pass-2026-10-19/replay/vehicle-map-results.json';
const base = resolve(root, source, '../..');
function copy(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-retained-map-unit-'));
  cpSync(base, directory, { recursive: true }); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const read = (file) => JSON.parse(readFileSync(resolve(directory, file)));
  const write = (file, value) => writeFileSync(resolve(directory, file), JSON.stringify(value, null, 2) + '\n');
  const bind = () => {
    const hashes = read('artifact-sha256.json');
    for (const file of Object.keys(hashes)) hashes[file] = createHash('sha256').update(readFileSync(resolve(directory, file))).digest('hex');
    write('artifact-sha256.json', hashes);
  };
  return { directory, read, write, bind, verify: () => validateRetainedVehicleMapDisplay(root, resolve(directory, 'replay/vehicle-map-results.json')) };
}
test('actual native map movement retains two reviewed captures, independent source bindings and verified disposal', () => {
  const report = validateRetainedVehicleMapDisplay(root, source);
  assert.equal(report.runId, '5b893d897b61e12aa6a53b2c4b29ac19');
  assert.equal(report.markerMovementPixels, 316.8864149817723);
  assert.equal(Object.keys(report.sourceFiles).length, 13);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-19');
  assert.equal(report.physicalDevice, false); assert.equal(report.providerTrackingVerified, false);
  const run = JSON.parse(readFileSync(resolve(base, 'run.json')));
  assert.equal(run.databaseId, 39325056323); assert.equal(run.headSha, '0fa64e812969c5690db62a7d4f39f51e3cb4deb6');
});
test('coherently rehashed but stronger claims, missing isolation or missing final disposal cannot pass', (t) => {
  for (const change of [
    (r) => { r.physicalDevice = true; }, (r) => { r.providerTrackingVerified = true; },
    (r) => { r.childPositionsVerified = true; }, (r) => { r.etaVerified = true; },
    (r) => { r.productionWrites = true; }, (r) => { r.safetyAuditAccepted = true; },
    (r) => { r.parentSignedOut = false; }, (r) => { r.isolatedEnvironmentDestroyed = false; },
    (r) => { r.fixtureIsolation.baselineRecordsPreserved = false; },
    (r) => { r.fixtureIsolation.otherLiveRidesPreserved = false; },
    (r) => { r.emulatorEndpoints.closed = false; }, (r) => { r.nativeCaseCount = 2; },
    (r) => { r.displays[1].arrivalBounds.top += 12; },
  ]) {
    const f = copy(t); const final = f.read('replay/vehicle-map-results.json'); change(final);
    f.write('replay/vehicle-map-results.json', final);
    for (const file of ['replay/local-vehicle-map-device.json', 'replay/vehicle-map-app-results.json']) {
      const related = f.read(file);
      for (const key of Object.keys(related)) related[key] = final[key];
      f.write(file, related);
    }
    f.bind(); assert.throws(f.verify);
  }
});
test('rehashed transfer, app-report, device-policy and provenance contradictions are rejected', (t) => {
  for (const [file, change] of [
    ['replay/adb-pull-vehicle-map.json', (r) => { r.completed = false; }],
    ['replay/vehicle-map-app-results.json', (r) => { r.runId = 'a'.repeat(32); }],
    ['disposable-store-restore.json', (r) => { r.verified = false; }],
    ['disposable-store-restore.json', (r) => { r.installAdmin.componentRemoved = false; }],
    ['retained-context.json', (r) => { r.fullNativeSuiteVerified = true; }],
    ['retained-context.json', (r) => { r.reviewedCaptures = ['local-vehicle-map-first.png']; }],
    ['run.json', (r) => { r.conclusion = 'failure'; }],
    ['run.json', (r) => { r.headSha = 'f'.repeat(40); }],
  ]) {
    const f = copy(t), value = f.read(file); change(value); f.write(file, value); f.bind(); assert.throws(f.verify);
  }
});
test('the portal adds actual map proof separately from older status checks and preserves the failed capture', () => {
  const flow = content.flows.find((f) => f.id === 'ride-observation');
  assert.equal(flow.status, 'partial'); assert.equal(flow.mapUi.source, source);
  assert.match(flow.ui.source, /ride-observation-native-2026-10-19/);
  assert.equal(flow.images.length, 18); assert.equal(flow.tour.length, 9);
  for (const [index, id] of ['first', 'moved'].entries()) {
    assert(flow.images.some(image => image.file === 'vehicle-map-' + id));
    assert.equal(captures['vehicle-map-' + id], `docs/release/evidence/vehicle-map-display-pass-2026-10-19/replay/local-vehicle-map-${id}.png`);
    assert.equal(flow.tour[index].image, 'vehicle-map-' + id);
  }
  assert.equal(flow.images.at(-1).file, 'vehicle-map-unverified');
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'blocked');
  assert.match(flow.remaining, /vraies positions.*téléphone/);
});
