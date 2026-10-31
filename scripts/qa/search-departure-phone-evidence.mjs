import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifySessionRestorationRecords} from './session-restoration-records.mjs';

export const searchDeparturePhoneFolder = 'docs/release/evidence/search-departure-phone-2026-10-31/';
export const searchDeparturePhonePhases = ['before', 'home', 'initial', 'calendar-open', 'calendar-cancelled',
  'date-chosen', 'clock-open', 'clock-chosen', 'navigated-back', 'search-reopened', 'dark', 'signed-out'];
export function validateSearchDeparturePhone(root) {
  const folder = resolve(root, searchDeparturePhoneFolder);
  const json = path => JSON.parse(readFileSync(resolve(folder, path)));
  assertEvidenceBundleChecksums(folder);
  const results = json('records/results.json'), review = json('review.json');
  assert.equal(review.scope, 'physical-android-search-date-and-time-not-search-results-or-booking');
  assert.equal(review.runId, '4d142924e3a1ef46d51a9e9c68070304');
  assert.equal(review.projectId, 'demo-sgm-local-qa');
  assert.deepEqual(review.device, {model: 'Google Pixel 9 Pro', android: '15.0', physical: true});
  assert.equal(results.completed, true); assert.equal(results.failure, false);
  assert.equal(results.adminClientClosed, true); assert.equal(results.firestoreClientTerminated, true);
  assert.equal(results.runId, review.runId); assert.equal(results.projectId, review.projectId);
  assert.deepEqual(results.checkpoints.map(row => row.phase), searchDeparturePhonePhases);
  assert.equal(review.checkpointCount, searchDeparturePhonePhases.length);
  const baseline = json('records/baseline.json');
  for (const phase of searchDeparturePhonePhases) {
    const checkpoint = json('records/' + phase + '.json');
    assert.equal(checkpoint.phase, phase); assert.equal(checkpoint.runId, review.runId);
    assert.deepEqual(checkpoint.isolation, verifySessionRestorationRecords(baseline, checkpoint.state));
    assert.match(checkpoint.recordedAt, /^2026-10-31T/);
  }
  assertRetainedSourceFiles(root, results.sourceFiles);
  assertRetainedSourceFiles(root, json('app-source-sha256.json'));
  const apk = json('apk-provenance.json');
  assert.equal(apk.filename, 'sgm-search-departure-20261030.apk');
  assert.equal(apk.sha256, 'c7c6f2a4b806c20a81c646b8d3fa0f06087f03c28babf26c80e7f9e23f35b08b');
  assert.equal(apk.installedBytesIndependentlyVerified, false);
  for (const key of ['physicalDateChoiceAccepted', 'physicalTimeChoiceAccepted', 'calendarCancellationAccepted',
    'returnToSearchAccepted', 'darkSearchVisualAccepted', 'signedOutObserved']) assert.equal(review[key], true, key);
  for (const key of ['previousAuthenticationFailureCauseEstablished', 'helperExitCauseEstablished',
    'installedBytesIndependentlyAttested', 'packageRemovalIndependentlyVerified', 'physicalSearchRecoveryAccepted',
    'physicalBookingRecoveryAccepted', 'searchSubmitted', 'fullProcessRestartAccepted', 'realMapsExercised',
    'realPaymentsExercised', 'productionWrites', 'iOSUiAccepted', 'screenReaderAccepted', 'releaseAccepted'])
    assert.equal(review[key], false, key);
  assert.equal(review.mapRequests, 0); assert.equal(results.providerRequests, 0); assert.equal(results.searchSubmitted, false);
  assert.equal(results.physicalUiProven, false, 'Stored-state observer does not prove screen interactions');
  assert.equal(review.initialDate, '01/11/2026'); assert.equal(review.initialTime, '12:53');
  assert.equal(review.selectedDate, '03/11/2026'); assert.equal(review.selectedTime, '15:30');
  assert.equal(review.captureKind, 'original-session-window-crops-not-native-device-exports');
  const names = ['calendar-open', 'clock-selected', 'clock-chosen', 'search-reopened', 'dark'];
  assert.deepEqual(review.publishedCaptures, Object.fromEntries(names.map(name =>
    ['search-departure-' + name, 'captures/' + name + '.jpg'])));
  for (const file of Object.values(review.publishedCaptures)) {
    const size = imageSize(readFileSync(resolve(folder, file)));
    assert.equal(size.width, 240); assert.equal(size.height, 510);
  }
  assert.deepEqual(review.privateHelperScope, {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false,
    invitationPagePortEnabled: false, startupDiagnosticApproved: true, requestLoggingEnabled: false});
  const phone = json('phone-disposal.json'); assert.equal(phone.signedOutObserved, true);
  assert.equal(phone.sessionEnded, true); assert.equal(phone.clipboardRestored, true);
  assert.equal(phone.uninstallCommandSubmitted, true); assert.equal(phone.uninstallAcknowledged, false);
  assert.equal(phone.uninstallResult, 'No user apps found to uninstall.');
  assert.equal(phone.packageAbsenceIndependentlyMeasured, false); assert.equal(phone.testDevicePolicyChanged, false);
  const disposal = json('disposal.json');
  for (const key of ['helperGroupExitVerified', 'runtimeAbsent', 'privateCredentialFileAbsent', 'helperDirectoryAbsent'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.observerExitCode, 0); assert.equal(disposal.backendExitCode, 130); assert.equal(disposal.helperExitCode, 130);
  const prep = json('helper-preparation.json'); assert.equal(prep.authenticationSubmitted, false);
  assert.equal(prep.requestedStop, false); assert.equal(prep.causeEstablished, false);
  return {checkpoints: searchDeparturePhonePhases.length, captures: names.length,
    physicalDateChoiceAccepted: true, physicalSearchRecoveryAccepted: false, releaseAccepted: false};
}
