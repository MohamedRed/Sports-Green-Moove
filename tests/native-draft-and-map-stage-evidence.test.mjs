import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { assertScheduleDraftRestart } from '../scripts/qa/trip-schedule-draft-evidence.mjs';
import { assertRealMapsUiProviderEvidence } from '../scripts/qa/real-maps-ui-evidence.mjs';
import { verifyRealMapDisplayFiles, assertFramedRealMapDisplay } from '../scripts/qa/real-map-display-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const url = (path) => new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url);
const bytes = (path) => readFileSync(url(path));
const text = (path) => bytes(path).toString('utf8');
function originals(base, count) {
  const json = (name) => JSON.parse(text(base + name));
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, count);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(bytes(base + name)).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(text(base + name), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  return { json, hashes };
}

const draftBase = 'docs/release/evidence/local-schedule-draft-native-2026-10-18/';
const mapsBase = 'docs/release/evidence/real-maps-native-2026-10-18/';

test('new schedule draft survives a different process with unchanged persisted records and all actual local groups', () => {
  const prefix = draftBase + 'originals/', { json, hashes } = originals(prefix, 97);
  const run = json('results.json'), stage = json('trip-schedule-draft-ui-stage.json');
  assert.equal(run.runId, '61c4bc3d855a68e23bb2645c914c171b');
  assert.equal(run.testedAt, '2026-10-18T08:52:44.371Z');
  assert.equal(run.scope, 'local-ui-not-physical-device'); assert.equal(run.testCount, 33); assert.equal(run.nativeCaseCount, 35);
  assert.equal(run.steps.length, 33); assert(run.steps.every((s) => s.status === 'passed'));
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 27);
  assert.equal(transcripts.reduce((count, name) => count + Number(text(prefix + name).match(/OK \((\d+) tests?\)/)?.[1] ?? 0), 0), 35);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-')); assert.equal(copies.length, 12);
  assert(copies.every((name) => json(name).completed === true));
  assert.deepEqual(run.tripScheduleDraftRestart, stage);
  assertScheduleDraftRestart(stage.native.before, stage.native.stopped, stage.native.after, stage, run.runId);
  assert.equal(stage.native.before.processId, 13067); assert.equal(stage.native.after.processId, 13209);
  assert.equal(stage.native.after.departureDate, '2026-10-20'); assert.equal(stage.native.after.departureTime, '13:00');
  assert.equal(stage.native.after.arrivalTime, '14:00'); assert.equal(stage.native.after.hasArrival, true);
  assert.deepEqual(stage.baseline, stage.checkpoint); assert.deepEqual(stage.persisted, stage.baseline);
  assert.equal(stage.automaticProposalCreated, false); assert.equal(stage.recordsUnchanged, true);
  assert.equal(stage.paymentExercised, false); assert.equal(stage.routeProviderExercised, false);
  const status = json('native-suite-status.json');
  assert.equal(status.localReplay, 0); assert.equal(status.componentEvidence, 0); assert.equal(status.ordinaryTests, 1);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(text(prefix + 'ordinary-ui.xml')).testsuite;
  assert.equal(suite.tests, 118); assert.equal(suite.skipped, 30); assert.equal(suite.failures, 5); assert.equal(suite.errors, 0);
  const failures = suite.testcase.filter((c) => Object.hasOwn(c, 'failure')); assert.equal(failures.length, 5);
  assert(failures.every((c) => String(c.failure).includes('InputWindowReadiness.awaitFocus')));
  const restore = json('disposable-store-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.match(text(draftBase + 'README.md'), /overall CI job remains failed/);
});

test('first real-map app attempt proves only address selection and retains its failed first-parent acknowledgement check', () => {
  const prefix = mapsBase + 'first-attempt/', { json } = originals(prefix, 14);
  const provider = json('replay/real-maps-provider.json');
  assert.deepEqual(provider.requests.map((r) => r.operation), ['autocomplete', 'place-details', 'autocomplete', 'place-details']);
  assert(provider.requests.every((r) => r.status === 200 && r.completed === true));
  assert.equal(provider.facts.filter((f) => f.operation === 'place-details').length, 2);
  const failed = text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt');
  assert.match(failed, /FAILURES!!!/); assert.match(failed, /Accords reçus : 1 \/ 2/); assert.match(failed, /Accords reçus : 0 \/ 2/);
  assert.match(failed, /Tests run: 1,  Failures: 1/);
  for (const name of ['results.json', 'verified.json', 'local-real-maps-applied.png']) assert.equal(existsSync(url(prefix + 'replay/' + name)), false, name);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.match(text(mapsBase + 'README.md'), /not of applying the route/);
});

test('the later native application has an independently matching provider join and successful cleanup', () => {
  const prefix = mapsBase + 'completed-application/', { json } = originals(prefix, 10);
  const run = json('replay/results.json'), verified = json('replay/verified.json'), provider = json('replay/real-maps-provider.json');
  assert.equal(run.runId, 'd718aaf86712d23ecf4f388c5079cbce');
  assert.equal(run.testedAt, '2026-10-18T09:10:02.158Z');
  assertRealMapsUiProviderEvidence(run, provider, verified.runId);
  assert.equal(verified.status, 'passed'); assert.equal(verified.approvedRequestLimit, 5);
  assert.equal(verified.testedAt, '2026-10-18T09:10:03.550Z'); assert.equal(verified.physicalDevice, false);
  assert.equal(verified.productionDataWritten, false); assert.equal(verified.paymentExercised, false);
  assert.equal(json('replay/adb-pull-real-maps-application.json').completed, true);
  assert.match(text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt'), /OK \(1 test\)/);
  const setup = json('disposable-device-setup.json'), restore = json('disposable-store-restore.json');
  assert.equal(restore.verified, true); assert.equal(restore.restored, true);
  assert.equal(setup.mapsRuntime.playServicesVersion, restore.observed.mapsRuntime.playServicesVersion);
  assert.match(text(mapsBase + 'README.md'), /Map rendering remains unverified and unavailable/);
  assert.match(text(mapsBase + 'README.md'), /Carte indisponible/);
});

test('the display-enabled failure stays incomplete before quote or map-load checkpoints', () => {
  const prefix = mapsBase + 'display-first-attempt/', { json } = originals(prefix, 15);
  const provider = json('replay/real-maps-provider.json');
  assert.deepEqual(provider.requests.map((r) => r.operation), ['autocomplete', 'place-details', 'autocomplete', 'place-details']);
  assert(provider.requests.every((r) => r.status === 200 && r.completed === true));
  assert.match(text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt'), /LocalRealMapsTripChangeTest.closeDialog/);
  assert.match(text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt'), /Tests run: 1,  Failures: 1/);
  for (const name of ['results.json', 'verified.json', 'local-real-maps-applied.png', 'local-real-map-display.png'])
    assert.equal(existsSync(url(prefix + 'replay/' + name)), false, name);
  assert.equal(text(prefix + 'replay/map-display-provider-errors.txt'), '');
  assert.equal(json('replay/adb-pull-failure-cleanup.json').completed, true);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.match(text(mapsBase + 'README.md'), /Do not infer a map load or key/);
});

test('actual loaded map tiles and application do not hide the separately observed clipped marker', () => {
  const prefix = mapsBase + 'completed-display/', { json } = originals(prefix, 13);
  const run = json('replay/results.json'), verified = json('replay/verified.json');
  assert.equal(run.runId, '21d7098846ec41c305f1dd90d315840c');
  assertRealMapsUiProviderEvidence(run, json('replay/real-maps-provider.json'), verified.runId);
  verifyRealMapDisplayFiles(run.native.mapDisplay, fileURLToPath(url(prefix + 'replay/')));
  assert.equal(verified.mapDisplayVerified, true); assert.equal(verified.mapFramingVerified, undefined);
  assert.throws(() => assertFramedRealMapDisplay(run.native.mapDisplay));
  assert.equal(run.native.mapDisplay.colorBins, 163); assert.equal(run.native.mapDisplay.samples, 13563);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.match(text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt'), /OK \(1 test\)/);
  assert.match(text(mapsBase + 'README.md'), /One departure marker head is clipped/);
});

test('package-update interruption cannot accept fitted-map or application completion', () => {
  const prefix = mapsBase + 'framing-interrupted/', { json } = originals(prefix, 15);
  const provider = json('replay/real-maps-provider.json');
  assert.equal(provider.requests.length, 4); assert(provider.requests.every((r) => r.status === 200 && r.completed));
  assert.match(text(prefix + 'replay/LocalRealMapsTripChangeTest-instrumentation.txt'), /shortMsg=Process crashed/);
  const exit = text(prefix + 'replay/real-maps-application-exit-info.txt');
  assert.match(exit, /reason=16 \(PACKAGE UPDATED\)/); assert.match(exit, /stop com.google.android.gms due to installPackageLI/);
  for (const name of ['results.json', 'verified.json', 'local-real-maps-applied.png', 'local-real-map-display.png'])
    assert.equal(existsSync(url(prefix + 'replay/' + name)), false, name);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.match(text(mapsBase + 'README.md'), /same-version package reinstallation/);
});

test('private portal adds the fitted map without promoting the historical clipped map or physical scope', () => {
  const flow = content.flows.find((f) => f.id === 'publication'); assert.equal(flow.status, 'partial');
  assert.equal(flow.images.length, 25); assert.equal(new Set(flow.images.map((i) => i.file)).size, 25);
  assert.deepEqual(flow.images.slice(0, 4).map((i) => i.file), ['trip-framed-map-visible', 'trip-framed-route-applied', 'trip-framed-places-selected', 'trip-real-map-visible']);
  assert.match(flow.images[0].alt, /Deux repères entièrement visibles/); assert.match(flow.images[1].alt, /appliqué après les deux accords/);
  assert.match(flow.images.find((i) => i.file === 'trip-real-map-visible').alt, /Ancien essai.*coupé/);
  // The original loaded raster remains weaker than the separately retained fitted-map proof.
  const display = mapsBase + 'completed-display/replay/';
  const run = JSON.parse(text(display + 'results.json')), verified = JSON.parse(text(display + 'verified.json'));
  assertRealMapsUiProviderEvidence(run, JSON.parse(text(display + 'real-maps-provider.json')), verified.runId);
  verifyRealMapDisplayFiles(run.native.mapDisplay, fileURLToPath(url(display)));
  assert.match(flow.verified, /Les cartes s’affichent/);
  assert.throws(() => assertFramedRealMapDisplay(run.native.mapDisplay));
  assert.match(content.blockers.find((b) => b.id === 'trip-management').text, /deux repères.*entièrement visibles/);
  assert.match(flow.remaining, /sur téléphone/); assert.match(flow.remaining, /paiements et remboursements réels/);
  assert.equal(captures['trip-real-places-selected'], mapsBase + 'first-attempt/replay/local-real-maps-selected.png');
  assert.equal(captures['trip-schedule-draft-restored'], draftBase + 'originals/local-trip-schedule-draft-restored.png');
  for (const id of ['trip-real-route-applied', 'trip-real-places-selected', 'trip-schedule-draft-restored']) {
    const png = bytes(captures[id]); assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  }
  assert.equal(captures['trip-real-route-applied'], mapsBase + 'completed-application/replay/local-real-maps-applied.png');
  assert(content.updates.some((u) => u.title === 'La date et l’arrivée reviennent dans le brouillon'));
  assert.match(content.blockers.find((b) => b.id === 'test-device-stability').text, /interruptions.*restent à expliquer/);
  const displayPng = bytes(captures['trip-real-map-visible']);
  assert.equal(displayPng.readUInt32BE(16), 1080); assert.equal(displayPng.readUInt32BE(20), 2400);
  assert.equal(captures['trip-real-map-visible'], display + 'local-real-map-display.png');
});
