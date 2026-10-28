import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {directBookingPhonePhases, verifyDirectBookingCheckpoint} from './direct-booking-phone-checkpoints.mjs';

export const directBookingEvidenceDirectory = 'docs/release/evidence/direct-booking-confirmation-2026-10-28';

export function assertDirectBookingEvidence({summary, session, baseline, checkpoints, observations, cleanup, runtime, captures, approval}) {
  assert.equal(summary.scope, 'physical-android-direct-booking-confirmation-and-restart-not-search-retry-or-release-proof');
  assert.equal(summary.projectId, 'demo-sgm-local-qa'); assert.match(summary.runId, /^[a-f0-9]{32}$/);
  assert.match(summary.sourceBaselineCommit, /^[a-f0-9]{40}$/); assert.match(summary.sourceApkSha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.sourceWasWorkingTree, true); assert.equal(summary.device.physical, true);
  assert.equal(summary.device.count, 1); assert.equal(summary.device.os, 'Android 15');
  assert.equal(summary.completedCheckpoints, 8); assert.equal(summary.addedBookings, 1); assert.equal(summary.verifiedProcessRestarts, 1);
  for (const flag of ['openingAndDismissalCreateNoBooking', 'explicitConfirmationObserved', 'sameRequestRestoredFromHomeAndTrips'])
    assert.equal(summary[flag], true, flag);
  for (const flag of ['installedBytesIndependentlyVerified', 'nativeComponentTestsExecuted', 'physicalUnconfirmedReplyRetryVerified',
    'searchScreenRestartVerified', 'otherAccountsPhysicallyTested', 'simultaneousPhones', 'realPaymentExercised', 'productionWrites',
    'productionDeployed', 'releaseComplete', 'nativeScreenshotExportAccepted', 'videoAccepted']) assert.equal(summary[flag], false, flag);
  assert.equal(summary.providerMapRequests, 0); assert.equal(summary.publicCaptureMethod, 'browser-session-window-not-native-export');
  for (const record of [session, baseline, cleanup, ...checkpoints]) {
    assert.equal(record.projectId, summary.projectId); assert.equal(record.runId, summary.runId);
  }
  assert.equal(session.scope, 'independent-direct-booking-records-not-phone-ui-or-release-proof');
  assert.equal(session.testedAt, summary.testedAt); assert.equal(session.completed, true);
  for (const flag of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(session[flag], true);
  for (const flag of ['physicalUiProven', 'wholeProcessRestartProven', 'productionWrites', 'paymentExercised']) assert.equal(session[flag], false);
  assert.equal(checkpoints.length, 8); assert.equal(session.checkpoints.length, 8);
  let bookingId, previous;
  for (const [index, row] of checkpoints.entries()) {
    assert.equal(row.phase, directBookingPhonePhases[index]);
    const result = verifyDirectBookingCheckpoint(row.phase, baseline.baseline, row.state, bookingId);
    assert.deepEqual(row.result, result); assert.deepEqual(session.checkpoints[index], result);
    if (bookingId) assert.deepEqual(row.state, previous);
    bookingId = result.bookingId ?? bookingId; previous = row.state;
  }
  const observation = phase => {
    const rows = observations.filter(row => row.phase === phase); assert.equal(rows.length, 1, phase); return rows[0];
  };
  assert.equal(observation('opened-no-write').confirmationVisible, true);
  assert.equal(observation('dismissed-no-write').confirmationDismissed, true);
  assert.equal(observation('confirmed').acknowledgement, 'Demande envoyée.');
  for (const phase of ['confirmed', 'reopened', 'process-restarted', 'other-card']) assert.equal(observation(phase).sendActionAbsent, true);
  for (const phase of ['reopened', 'process-restarted', 'other-card']) assert.equal(observation(phase).status, 'Votre demande est en attente.');
  assert.equal(observation('home-restored').credentialsReentered, false);
  assert.equal(observation('process-restarted').newRequestSubmitted, false);
  assert.equal(observation('native-stop').androidForceStopConfirmationClicked, true);
  assert.equal(observation('native-stop').appInfoName, 'SPORTS GREEN-mOOVe');
  const process = ['process-before-stop', 'process-stopped', 'process-after-restart'].map(observation);
  assert.deepEqual(process.map(row => row.previousCount), [0, 1, 2]);
  assert.deepEqual(process.map(row => row.processAbsent), [false, true, false]);
  assert(Number.isInteger(process[0].pid) && process[0].pid > 0); assert.equal(process[1].pid, null);
  assert(Number.isInteger(process[2].pid) && process[2].pid > 0); assert.notEqual(process[2].pid, process[0].pid);
  for (const row of process) assert.equal(row.command, 'dumpsys meminfo be.sportgreenmoove.app.local');
  for (const [first, last] of [[process[0], observation('native-stop')], [observation('native-stop'), process[1]],
    [process[1], observation('home-restored')], [observation('process-restarted'), process[2]]])
    assert(Date.parse(first.observedAt) <= Date.parse(last.observedAt));
  assert.equal(observation('signed-out').blankLoginFormObserved, true);
  assert.equal(observation('uninstall-acknowledged').providerAcknowledgementObserved, true);
  assert.equal(observation('package-absent').output, 'Unable to find package: be.sportgreenmoove.app.local');
  assert.equal(observation('package-absent').independentlyObserved, true);
  assert.equal(observation('phone-released').idleDashboardObserved, true);
  for (const flag of ['listenerIdentityObservedBeforeStop', 'processGroupExited', 'ownerStopRequested', 'privateSessionAbsent',
    'runtimeAbsent', 'helperDirectoryAbsent']) assert.equal(cleanup[flag], true, flag);
  assert.equal(cleanup.runtimeExitCode, 0); assert.equal(cleanup.helperExitCode, 130); assert.equal(cleanup.observerExitCode, 0);
  assert.deepEqual(cleanup.ports, [5001, 8080, 9000, 9099, 45690, 45691].map(port => ({port, available: true})));
  for (const flag of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(runtime[flag], true);
  assert.equal(runtime.failed, false);
  assert(Date.parse(cleanup.observedAt) >= Date.parse(observation('phone-released').observedAt));
  assert.equal(approval.approved, true); assert.equal(approval.sameSyntheticEvidenceWorkflow, true);
  assert.equal(approval.scope, 'session-window-captures-for-progress-website-not-native-exports');
  assert.equal(approval.nativeExportClaimAllowed, false); assert.equal(approval.publicAudienceUnchanged, true);
  assert.equal(captures.length, 4); assert.equal(summary.publicCaptureCount, 4);
  assert.deepEqual(captures.map(row => row.phase), ['opened-no-write', 'confirmed', 'process-restarted', 'other-card']);
  for (const capture of captures) {
    assert.equal(capture.original, observation(capture.phase).capture); assert.equal(capture.reviewedSyntheticContentOnly, true);
    assert.equal(capture.method, summary.publicCaptureMethod);
    assert.deepEqual(capture.crop, {x: 630, y: 110, width: 242, height: 530});
  }
  return summary;
}

export function validateDirectBookingEvidence(root, source = directBookingEvidenceDirectory + '/summary.json') {
  const base = dirname(resolve(root, source)), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  assertEvidenceBundleChecksums(base);
  const report = {summary: json('summary'), session: json('phone/checkpoints/session-results'),
    baseline: json('phone/checkpoints/baseline'), checkpoints: directBookingPhonePhases.map(phase => json('phone/checkpoints/' + phase)),
    observations: json('phone/ui-observations'), cleanup: json('phone/runtime-disposal'), runtime: json('phone/runtime/runtime-cleanup'),
    captures: json('public-captures'), approval: json('session-capture-approval')};
  assertDirectBookingEvidence(report); assertRetainedSourceFiles(root, report.session.sourceFiles);
  assertRetainedSourceFiles(root, json('native-build-sources'));
  const xml = file => new XMLParser({ignoreAttributes: false}).parse(readFileSync(resolve(base, file), 'utf8')).testsuite;
  const before = xml('controller-before.xml'), after = xml('controller-after.xml');
  assert.equal(Number(before['@_tests']), 1); assert.equal(Number(before['@_failures']), 1);
  assert.match(before.testcase.failure['@_message'], /expected:<1> but was:<3>/);
  assert.equal(Number(after['@_tests']), 11); assert.equal(Number(after['@_failures']), 0); assert.equal(Number(after['@_errors']), 0);
  const totals = {tests: 0, failures: 0, errors: 0, skipped: 0};
  for (const file of readdirSync(resolve(base, 'native-unit-results'))) {
    assert(file.endsWith('.xml'));
    const suite = xml('native-unit-results/' + file);
    for (const key of Object.keys(totals)) totals[key] += Number(suite['@_' + key] ?? 0);
  }
  assert.deepEqual(totals, {tests: 613, failures: 0, errors: 0, skipped: 0});
  const recheck = json('composition-recheck/summary');
  assert.equal(recheck.scope, 'post-phone-home-composition-extraction-local-unit-and-compilation-only');
  for (const flag of ['phoneRerun', 'installedApkSourceUnchanged', 'nativeComponentTestsExecuted', 'preparationProductCodeChanged'])
    assert.equal(recheck[flag], false);
  assert.equal(recheck.nativeComponentTestsCompiled, true);
  assertRetainedSourceFiles(root, json('composition-recheck/source-files'));
  const rechecked = {tests: 0, failures: 0, errors: 0, skipped: 0};
  const suites = readdirSync(resolve(base, 'composition-recheck/native-unit-results'));
  assert.equal(suites.length, recheck.suites);
  for (const file of suites) {
    assert(file.endsWith('.xml'));
    const suite = xml('composition-recheck/native-unit-results/' + file);
    for (const key of Object.keys(rechecked)) rechecked[key] += Number(suite['@_' + key] ?? 0);
  }
  assert.deepEqual(rechecked, totals);
  for (const [key, value] of Object.entries(rechecked)) assert.equal(recheck[key], value);
  const preparation = xml('composition-recheck/preparation-failure/TEST-be.sportgreenmoove.app.ui.SupportSubmissionStateTest.xml');
  assert.equal(Number(preparation['@_failures']), 6);
  for (const testcase of [].concat(preparation.testcase)) if (testcase.failure)
    assert.match(testcase.failure['@_message'], /No space left on device/);
  assert.match(readFileSync(resolve(base, 'composition-recheck/gradle.log'), 'utf8'), /BUILD SUCCESSFUL/);
  for (const capture of report.captures) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'phone', capture.original))).digest('hex'), capture.originalSha256);
    assert.equal(capture.file, 'captures/' + capture.phase + '.png');
    const png = readFileSync(resolve(base, capture.file)); assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 242); assert.equal(png.readUInt32BE(20), 530);
  }
  for (const phase of ['process-before-stop', 'process-stopped', 'process-after-restart']) {
    const ax = readFileSync(resolve(base, 'phone', phase + '-console-ax.txt'), 'utf8');
    const row = report.observations.find(item => item.phase === phase);
    if (row.processAbsent) assert.match(ax, /text No process found for: be\.sportgreenmoove\.app\.local/);
    else assert(ax.includes(`MEMINFO in pid ${row.pid} [be.sportgreenmoove.app.local]`));
  }
  assert.match(readFileSync(resolve(base, 'phone/package-absence-console-ax.txt'), 'utf8'), /Unable to find package: be\.sportgreenmoove\.app\.local/);
  return report.summary;
}
