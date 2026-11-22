import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assertRealMapsUiProviderEvidence } from '../scripts/qa/real-maps-ui-evidence.mjs';
import { assertFramedRealMapDisplay, verifyRealMapDisplayFiles } from '../scripts/qa/real-map-display-evidence.mjs';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const prefix = 'docs/release/evidence/real-maps-native-2026-10-18/completed-framing/';
const base = new URL('../' + prefix, import.meta.url);
const bytes = (name) => readFileSync(new URL(name, base));
const json = (name) => JSON.parse(bytes(name));

test('framing acceptance retains all thirteen originals and separately scoped reviewed evidence', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 14);
  for (const [name, hash] of Object.entries(hashes)) {
    assert(!name.includes('..') && !name.startsWith('/'));
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(bytes(name).toString(), /AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|"password"\s*:/);
  }
  const acceptance = json('acceptance.json');
  assert.equal(acceptance.scope, 'reviewed-emulator-real-map-framing-and-application-not-physical-device');
  assert.equal(acceptance.status, 'passed'); assert.equal(acceptance.sourceJobCompleted, true);
  assert.equal(acceptance.sourceCommit, 'ff20fffa07d5da5f020e7b7b9252afe50bf1631a');
  assert.equal(acceptance.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39125211691');
  assert.equal(acceptance.artifactId, 12135474645); assert.equal(acceptance.originalFileCount, 13);
  assert.equal(acceptance.bothMarkerHeadsVisuallyReviewed, true); assert.equal(acceptance.mapGeographyVisuallyReviewed, true);
  for (const flag of ['physicalDevice', 'paymentExercised', 'productionDataWritten', 'trackingVerified', 'iosVerified'])
    assert.equal(acceptance[flag], false, flag);
});

test('successful native, provider, route, raster and framing proof must join under the same replay', () => {
  const acceptance = json('acceptance.json'), result = json('replay/results.json'), verified = json('replay/verified.json');
  assert.equal(result.runId, acceptance.runId); assert.equal(verified.runId, result.runId);
  assert.equal(result.projectId, acceptance.projectId);
  assertRealMapsUiProviderEvidence(result, json('replay/real-maps-provider.json'), acceptance.runId);
  assertFramedRealMapDisplay(result.native.mapDisplay);
  verifyRealMapDisplayFiles(result.native.mapDisplay, fileURLToPath(new URL('replay/', base)));
  assert.equal(verified.status, 'passed'); assert.equal(verified.mapFramingVerified, true);
  assert.equal(verified.mapDisplayVerified, true); assert.equal(verified.approvedRequestLimit, 5);
  assert.equal(acceptance.providerRequestCount, 5); assert.equal(verified.physicalDevice, false);
  assert.equal(result.route.distanceMeters, 7512); assert.equal(result.route.durationSeconds, 580);
  assertInstrumentationPassed(bytes('replay/LocalRealMapsTripChangeTest-instrumentation.txt').toString(), 1);
  assert.deepEqual(result.native, json('replay/local-real-maps-ui.json'));
});

test('framing acceptance requires the original primary copy and restored original store policy', () => {
  const acceptance = json('acceptance.json'), copy = json('replay/adb-pull-real-maps-application.json');
  assert.equal(copy.runId, acceptance.runId); assert.equal(copy.phase, 'real-maps-application');
  assert.equal(copy.completed, true); assert.equal(copy.status, 0);
  assert.equal(copy.errorCode, null); assert.equal(copy.signal, null);
  assert.equal(acceptance.primaryEvidenceCopyCompleted, true);
  const before = json('disposable-device-setup.json'), after = json('disposable-store-restore.json');
  assert.equal(after.restored, true); assert.equal(after.verified, true);
  assert.equal(after.observed.mapsRuntime.playServicesVersion, before.mapsRuntime.playServicesVersion);
  assert.equal(after.observed.locationEnabled, true); assert.equal(after.observed.noActiveStoreInstall, true);
  assert.equal(after.observed.mapsRuntime.playServicesEnabled, true); assert.equal(after.observed.mapsRuntime.playStoreEnabled, true);
  assert.equal(acceptance.storePolicyRestoredAndVerified, true);
});

test('current map captures are linked without replacing older clipped or unavailable maps', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.match(flow.remaining, /sur téléphone/);
  assert.match(flow.remaining, /paiements et remboursements réels/);
  for (const [key, name] of [['trip-framed-map-visible', 'local-real-map-display.png'],
    ['trip-framed-route-applied', 'local-real-maps-applied.png'], ['trip-framed-places-selected', 'local-real-maps-selected.png']]) {
    assert.equal(captures[key], prefix + 'replay/' + name);
    assert(flow.images.some((image) => image.file === key));
    assert.match(flow.images.find(image => image.file === key).alt, /18 octobre/);
  }
  assert.match(captures['trip-real-map-visible'], /completed-display/);
  assert.match(captures['trip-real-route-applied'], /completed-application/);
  assert.equal(flow.tour.length, 10);
  assert(flow.tour.slice(0, 5).every(step => /^cancel-stale-phone-/.test(step.image)));
  assert(flow.tour.slice(5).every(step => /^cancel-phone-/.test(step.image)));
  assert.equal(flow.ui.checkedAt, '2026-10-18');
});
