import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {verifySessionRestorationRecords} from './session-restoration-records.mjs';

const root = resolve(import.meta.dirname, '../..');
const trial = '/Users/mrr/.codex/sgm-native-comparison-20261031/search-departure-phone-retry';
const destination = resolve(root, 'docs/release/evidence/search-departure-phone-2026-10-31');
assert.deepEqual(readdirSync(destination), ['README.md'], 'Only the prepared review may exist before retention');
const sha = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path));
const results = json(resolve(trial, 'records/results.json'));
assert.equal(results.completed, true); assert.equal(results.failure, false);
assert.equal(results.runId, '4d142924e3a1ef46d51a9e9c68070304');
const baseline = json(resolve(trial, 'records/baseline.json'));
for (const row of results.checkpoints) {
  const checkpoint = json(resolve(trial, 'records', row.phase + '.json'));
  assert.deepEqual(checkpoint.isolation, verifySessionRestorationRecords(baseline, checkpoint.state));
}
assert(!existsSync(resolve(trial, 'runtime/session.private.json')));
assert(!existsSync('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-local-runtime-E5OlsJ'));
assert(!existsSync('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-mlgHQ0'));
const output = mkdtempSync(resolve(dirname(destination), '.search-phone-stage-'));
try {
  mkdirSync(resolve(output, 'records')); mkdirSync(resolve(output, 'captures'));
  const files = [];
  const save = (path, bytes) => {writeFileSync(resolve(output, path), bytes, {flag: 'wx'}); files.push(path);};
  const copy = (from, to) => save(to, readFileSync(from));
  const record = (path, value) => save(path, JSON.stringify(value, null, 2) + '\n');
  for (const file of ['baseline', 'results', ...results.checkpoints.map(row => row.phase)])
    copy(resolve(trial, 'records', file + '.json'), 'records/' + file + '.json');
  for (const file of ['helper-preparation.json', 'phone-disposal.json']) copy(resolve(trial, file), file);
  const images = ['home', 'initial', 'calendar-open', 'calendar-cancelled', 'date-chosen', 'clock-open',
    'clock-selected', 'clock-chosen', 'search-reopened', 'dark', 'dark-clock-open', 'dark-clock-cancelled', 'signed-out'];
  for (const name of images) copy(resolve(trial, 'captures', name + '.jpg'), 'captures/' + name + '.jpg');
  const old = resolve(root, 'docs/release/evidence/search-departure-2026-10-31');
  copy(resolve(old, 'candidate/apk.json'), 'apk-provenance.json');
  copy(resolve(old, 'final/source-sha256.json'), 'app-source-sha256.json');
  for (const [path, digest] of Object.entries(results.sourceFiles)) {
    const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), digest);
    const archive = resolve(root, 'docs/release/evidence/source-archive', digest + '.txt');
    if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes);
    else writeFileSync(archive, bytes, {flag: 'wx'});
  }
  record('disposal.json', {observedAt: new Date().toISOString(), observerExitCode: 0, backendExitCode: 130,
    helperExitCode: 130, requestedHelperShutdown: true, helperGroupExitVerified: true,
    runtimeAbsent: true, privateCredentialFileAbsent: true, helperDirectoryAbsent: true,
    productionTouched: false, otherBrowserTabsClosed: false});
  const published = ['calendar-open', 'clock-selected', 'clock-chosen', 'search-reopened', 'dark'];
  record('review.json', {scope: 'physical-android-search-date-and-time-not-search-results-or-booking',
    reviewedAt: '2026-10-31', projectId: results.projectId, runId: results.runId,
    device: {model: 'Google Pixel 9 Pro', android: '15.0', physical: true},
    physicalDateChoiceAccepted: true, physicalTimeChoiceAccepted: true, calendarCancellationAccepted: true,
    returnToSearchAccepted: true, darkSearchVisualAccepted: true, signedOutObserved: true,
    initialDate: '01/11/2026', initialTime: '12:53', selectedDate: '03/11/2026', selectedTime: '15:30',
    zoneLabel: 'Bruxelles', checkpointCount: results.checkpoints.length,
    captureKind: 'original-session-window-crops-not-native-device-exports',
    captureClip: {x: 440, y: 99, width: 240, height: 510},
    publishedCaptures: Object.fromEntries(published.map(name => ['search-departure-' + name, 'captures/' + name + '.jpg'])),
    privateHelperScope: {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false,
      invitationPagePortEnabled: false, startupDiagnosticApproved: true, requestLoggingEnabled: false},
    previousAuthenticationFailureCauseEstablished: false, helperExitCauseEstablished: false,
    installedBytesIndependentlyAttested: false, packageRemovalIndependentlyVerified: false,
    physicalSearchRecoveryAccepted: false, physicalBookingRecoveryAccepted: false, searchSubmitted: false,
    fullProcessRestartAccepted: false, realMapsExercised: false, mapRequests: 0, realPaymentsExercised: false,
    productionWrites: false, iOSUiAccepted: false, screenReaderAccepted: false, releaseAccepted: false,
    priorAttempt: 'docs/release/evidence/search-departure-2026-10-31/review.json'});
  record('artifact-sha256.json', Object.fromEntries(files.map(path => [path, sha(readFileSync(resolve(output, path)))])));
  for (const file of readdirSync(output)) renameSync(resolve(output, file), resolve(destination, file));
  console.log(JSON.stringify({output: destination, checkpointCount: results.checkpoints.length, publishedCaptures: published.length}));
} finally {rmSync(output, {recursive: true, force: true});}
