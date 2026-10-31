import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {mediaInstallCommands} from '../scripts/ci/media-tools-plan.mjs';
import {tripConsentPhonePhases, verifyTripConsentPhoneState} from '../scripts/qa/trip-consent-phone-checkpoints.mjs';
import {tripConsentPhoneTour, tripConsentPhoneCaptures} from '../partner-portal/trip-consent-phone.mjs';

const root = resolve(import.meta.dirname, '..');
const folder = resolve(root, 'docs/release/evidence/trip-consent-phone-2026-10-25');
const json = file => JSON.parse(readFileSync(resolve(folder, file)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('physical consent record checkpoints preserve baseline terms and all six bookings', () => {
  const run = json('session-results.json'), {fixture, baseline} = json('baseline.json');
  assert.equal(run.completed, true);
  assert.equal(run.adminClientClosed, true); assert.equal(run.firestoreClientTerminated, true);
  assert.equal(run.protectedRecordCount, 187);
  assert.equal(run.phoneUiProven, false); assert.equal(run.wholeProcessRestartProven, false);
  assert.equal(run.routeProviderRequests, 0); assert.equal(run.productionWrites, false);
  assert.equal(run.applicationExercised, false); assert.equal(run.realPaymentExercised, false);
  assert.deepEqual(run.checkpoints.map(row => row.phase), tripConsentPhonePhases);
  assert.deepEqual(fixture, run.fixture);
  for (const row of Object.values(fixture.fixtures)) {
    const {pendingChangeId, updatedAt, ...original} = baseline.documents.trips.find(trip => trip.id === row.tripId).data;
    assert.equal(pendingChangeId, undefined); assert.deepEqual(row.before, original);
  }
  for (const [index, phase] of tripConsentPhonePhases.entries()) {
    const record = json(phase + '.json');
    assert.equal(record.runId, run.runId); assert.equal(record.projectId, 'demo-sgm-local-qa');
    assert.deepEqual(verifyTripConsentPhoneState(phase, fixture, record.state, baseline), run.checkpoints[index]);
    for (const {data: change} of record.state.documents.tripChanges ?? []) {
      const own = Object.values(fixture.fixtures).find(row => row.tripId === change.tripId);
      if (!own) continue;
      const trip = own.before;
      assert.deepEqual(change.originalTerms, {departureAt: trip.departureAt, arrivalBy: trip.arrivalBy ?? null,
        origin: trip.origin, destination: trip.destination, priceCents: trip.priceCents});
    }
  }
});

test('retained sources and reviewed viewport images remain exact, without claiming a video', () => {
  for (const [source, sha] of Object.entries(json('session-results.json').sourceFiles)) {
    assert.match(source, /^scripts\/qa\/[a-z-]+\.mjs$/); assert(existsSync(resolve(root, source)));
    assert.equal(hash(readFileSync(resolve(folder, 'source', source.split('/').at(-1) + '.txt'))), sha);
  }
  for (const [file, sha] of Object.entries(json('artifact-sha256.json')))
    assert.equal(hash(readFileSync(resolve(folder, file))), sha);
  assert.equal(tripConsentPhoneTour.length, 6);
  for (const step of tripConsentPhoneTour) {
    const path = resolve(root, tripConsentPhoneCaptures[step.image]);
    const bytes = readFileSync(path); assert.equal(bytes.readUInt16BE(0), 0xffd8);
    const stream = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height',
      '-of', 'json', path], {encoding: 'utf8'})).streams[0];
    assert.equal(stream.width, 253); assert.equal(stream.height, 564);
  }
  assert.match(readFileSync(resolve(folder, 'phone-cleanup.txt'), 'utf8'), /command invalid or not supported/);
});

test('the newer successful native job status supersedes only the historical preparation blocker', () => {
  const run = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/native-checks-9b59f31-2026-10-25/run.json')));
  assert.equal(run.headSha, '9b59f3113021c5e03024f083102d6d321fc22049');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  for (const name of ['Android native UI tests', 'Android native unit tests',
    'Android focused safety UI tests / Isolated safety flows'])
    assert.equal(run.jobs.find(job => job.name === name)?.conclusion, 'success');
  assert.equal(run.jobs.filter(job => /^Android focused.*Isolated (?!safety flows)/.test(job.name) && job.conclusion === 'success').length, 10);
  assert.equal(run.jobs.find(job => job.name === 'iOS native UI tests')?.conclusion, 'skipped');
  const smoke = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  const setupAt = smoke.indexOf('name: Install media inspection tools');
  assert(setupAt >= 0 && setupAt < smoke.indexOf('name: Validate physical trip consent checkpoints'));
  assert(smoke.includes('node scripts/ci/install-media-tools.mjs'));
  const installation = mediaInstallCommands('/tmp/sgm-proof/ubuntu.sources');
  assert(installation.some(([command, args]) => command === 'sudo' && args[0] === 'apt-get' &&
    args.includes('install') && args.includes('--yes') && args.includes('--no-install-recommends') && args.includes('ffmpeg')));
  assert.deepEqual(installation.slice(-2), [['ffmpeg', ['-version']], ['ffprobe', ['-version']]]);
  for (const file of ['trip-consent-phone-checkpoints.test.mjs', 'trip-consent-phone-evidence.test.mjs']) {
    assert.equal(smoke.split('"tests/' + file + '"').length - 1, 2);
    assert(smoke.includes('node --test tests/trip-consent-phone-checkpoints.test.mjs tests/trip-consent-phone-evidence.test.mjs'));
  }
});
