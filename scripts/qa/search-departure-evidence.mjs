import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertSearchDepartureNativeCases, searchDepartureArchiveMembers, searchDepartureCandidate} from './search-departure-native-cases.mjs';
import {verifySessionRestorationRecords} from './session-restoration-records.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export const searchDepartureFolder = 'docs/release/evidence/search-departure-2026-10-31/';
export function validateSearchDepartureEvidence(root) {
  const folder = resolve(root, searchDepartureFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), text = file => bytes(file).toString();
  const sha = value => createHash('sha256').update(value).digest('hex');
  assertEvidenceBundleChecksums(folder);
  const parser = new XMLParser({ignoreAttributes: false}), unitNames = [
    'winterLabelsUseBelgianLocalTimeWithoutLeakingWireSyntax', 'summerLabelsUseTheSameZoneAsTheTripList',
    'dateCanCrossMidnightInBelgium', 'phoneTimezoneDoesNotChangeTheSearchCriteria',
    'aMissingSpringHourNeverSelectsAnImplicitReplacement', 'aRepeatedAutumnHourDoesNotSilentlyChooseAnOffset',
    'bothExplicitInstantsOfARepeatedHourRemainReadable', 'validLeapDayAndMonthBoundaryRemainExact',
    'invalidWireDatesAreExplicitlyUnavailableNotReplacedWithNow', 'selectingOnlyTheDatePreservesTheOriginalClockPrecision',
  ];
  for (const stage of ['candidate', 'final']) {
    const suite = parser.parse(bytes(stage + '/units.xml')).testsuite;
    assert.equal(suite['@_tests'], '10'); assert.equal(suite['@_failures'], '0');
    assert.equal(suite['@_errors'], '0'); assert.equal(suite['@_skipped'], '0');
    assert.deepEqual(suite.testcase.map(row => row['@_name']).sort(), [...unitNames].sort());
    assert(suite.testcase.every(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.SearchDepartureInputTest' &&
      !['failure', 'error', 'skipped'].some(key => Object.hasOwn(row, key))));
    assert.match(text(stage + '/build.txt'), /BUILD SUCCESSFUL/);
    assertRetainedSourceFiles(root, json(stage + '/source-sha256.json'));
  }
  assert.match(parser.parse(bytes('final/units.xml')).testsuite['@_timestamp'], /^2026-10-31T/);
  assertRetainedSourceFiles(root, json('before/source-sha256.json'));
  assert.match(text('preparation/initial-build.txt'), /actual type is 'ComposeTestRule', but 'ComposeContentTestRule' was expected/);
  assert.match(text('preparation/initial-build.txt'), /BUILD FAILED/);
  assert.match(text('preparation/helper-corrected-build.txt'), /BUILD SUCCESSFUL/);
  assert.match(text('preparation/scroll-host-build.txt'), /BUILD SUCCESSFUL/);
  assert.match(text('preparation/identifier-build.txt'), /BUILD SUCCESSFUL/);
  const candidateSources = json('candidate/source-sha256.json'), finalSources = json('final/source-sha256.json');
  for (const path of Object.keys(candidateSources).filter(path => path.includes('/src/main/')))
    assert.equal(finalSources[path], candidateSources[path], 'Physical candidate production source: ' + path);
  const superseded = json('preparation/superseded-ci.json'); assert.equal(superseded.length, 3);
  for (const [index, [runId, jobId, source]] of [[41191055063, 124507757171, '8e0b1c5ceeb25145a4ecbb36985c03ae55086a76'],
    [41192580807, 124512188895, 'e87238d9632e4cb68c80528117dd6a4faeebdefe'],
    [41192836560, 124512961780, '4e15431cccbfb9df616776c069daa4ffa3dc9ef0']].entries()) {
    const previous = superseded[index]; assert.equal(previous.run.id, runId); assert.equal(previous.job.id, jobId);
    assert.equal(previous.sourceCommit, source); assert.equal(previous.cancellationRequestedByAgent, true); assert.equal(previous.accepted, false);
    for (const row of [previous.run, previous.job]) {
      assert.equal(row.head_sha, source); assert.equal(row.status, 'completed'); assert.equal(row.conclusion, 'cancelled');
    }
    assertRetainedSourceFiles(root, previous.sourceFiles);
  }
  const initial = text('preparation/initial-ordinary-instrumentation.txt');
  assert.match(initial, /Semantic Node has no parent layout with a Scroll SemanticsAction/);
  assert.match(initial, /SearchDepartureFlowTest.cancellingEitherNativePickerPreservesTheAcceptedChoiceWithoutAnEdit/);
  assert.match(initial, /Tests run: 268,\s+Failures: 2/);
  assert.throws(() => parseAndroidJUnitTranscript(initial));
  const firstArtifact = json('preparation/initial-artifact.json'), firstSelection = json('preparation/initial-selection.json');
  assert.equal(firstArtifact.workflow_run.id, superseded[0].run.id); assert.equal(firstArtifact.workflow_run.head_sha, superseded[0].sourceCommit);
  assert.equal(firstArtifact.digest, 'sha256:e7b86475379b557d26363a63133402c8a797eee3cbfa12bf8cd436b7c35a8aca');
  assert.equal(firstSelection.accepted, false); assert.equal(firstSelection.archiveRetainedPrivately, true);
  assert.deepEqual(firstSelection.members, Object.fromEntries(['ordinary-instrumentation.txt', 'ordinary-process.json']
    .map(file => ['outputs/store-review-screenshots/' + file, sha(bytes('preparation/initial-' + file))])));
  const old = json('before/review.json');
  assert.equal(old.baseHead, 'ea648f67a2fd42f3f3f38c8a8abedc5971a0d548');
  assert.equal(old.beforeNativePickerRegressionExecuted, false);
  assert.equal(sha(readFileSync(resolve(root, old.previousSearchCapture))), old.previousCaptureSha256);
  const apk = json('candidate/apk.json'); assert.equal(apk.sourceHead, old.baseHead);
  assert.equal(apk.sha256, 'c7c6f2a4b806c20a81c646b8d3fa0f06087f03c28babf26c80e7f9e23f35b08b');
  assert.equal(apk.packageId, 'be.sportgreenmoove.app.local'); assert.equal(apk.workingTreeSourcesRetained, true);
  for (const key of ['cleanCheckoutAttested', 'installedBytesIndependentlyVerified', 'nativeUiCasesExecutedLocally',
    'nativeUiCasesExecutedOnPhysicalPhone']) assert.equal(apk[key], false, key);
  assert.equal(apk.nativeUiCasesBuilt, 9);
  const run = json('native/run.json'), job = json('native/job.json'), artifact = json('native/artifact.json');
  assert.equal(run.id, 41193370066); assert.equal(job.id, 124514507012); assert.equal(job.run_id, run.id);
  for (const row of [run, job]) {assert.equal(row.head_sha, searchDepartureCandidate); assert.equal(row.status, 'completed');}
  assert.equal(run.conclusion, 'failure'); assert.equal(job.conclusion, 'failure');
  const nativeJobs = json('native/jobs.json'); assert.equal(nativeJobs.total_count, nativeJobs.jobs.length);
  const focused = nativeJobs.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.head_sha === searchDepartureCandidate && row.status === 'completed' && row.conclusion === 'success'));
  assert.equal(artifact.workflow_run.head_sha, searchDepartureCandidate); assert.equal(artifact.workflow_run.id, run.id);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.expired, false);
  const selection = json('native/selection.json');
  assert.equal(artifact.digest, 'sha256:' + selection.archiveSha256); assert.equal(selection.archiveRetainedPrivately, true);
  assert.equal(selection.selectedMemberComparedByteForByte, true);
  assert.equal(selection.fullReplayResultMemberAbsent, true);
  assert.deepEqual(selection.members, Object.fromEntries(Object.entries(searchDepartureArchiveMembers)
    .map(([file, member]) => [member, sha(bytes('native/' + file))])));
  const ordinary = json('native/ordinary-results.json'), parsed = parseAndroidJUnitTranscript(text('native/ordinary-instrumentation.txt'));
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(ordinary[key], value);
  const process = json('native/ordinary-process.json'); assert.equal(process.status, 0); assert.equal(process.signal, null);
  assert.equal(process.errorCode, null);
  const cases = assertSearchDepartureNativeCases(ordinary); assert.equal(cases.length, 11);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [268, 214, 54, 0]);
  assert.deepEqual(selection.cases, cases);
  assert.deepEqual(json('native/native-suite-status.json'),
    {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  assertRetainedSourceFiles(root, json('native/replay-source-sha256.json'));
  const network = json('native/chat-network/ui.json'); assert.equal(network.runId, '31c53c811db40113e924455179fd1834');
  assert.equal(network.projectId, 'demo-sgm-local-qa'); assert.equal(network.completed, false);
  assert.equal(network.failedPhase, 'network-preparation'); assert.deepEqual(network.network, []);
  assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  for (const phase of ['initialNetwork', 'preparation', 'preparationFailure']) {
    assert.equal(network[phase].backendReachable, true); assert.deepEqual(network[phase].activeInternetTransports, ['cellular']);
    const wifi = network[phase].capabilityObservation.available.find(row => row.transports.includes('wifi'));
    assert.equal(wifi.validated, false);
  }
  const networkText = text('native/chat-network/instrumentation.txt');
  assert.match(networkText, /ComposeTimeoutException: Condition still not satisfied after 30000 ms/);
  assert.match(networkText, /LocalChatNetworkFlowTest.kt:82/); assert.match(networkText, /Tests run: 1,\s+Failures: 1/);
  assert(!Object.hasOwn(network, 'offlineSendUnconfirmed')); assert(!Object.hasOwn(network, 'recoveredSendConfirmed'));
  const cleanupCopy = json('native/chat-network/failure-cleanup-copy.json');
  assert.equal(cleanupCopy.phase, 'failure-cleanup'); assert.equal(cleanupCopy.runId, network.runId); assert.equal(cleanupCopy.completed, true);
  const restored = json('native/disposable-store-restore.json'); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
  const local = text('preparation/local/instrumentation.txt'), localClosure = json('preparation/local/closure.json');
  assert.match(local, /^OK \(11 tests\)\s*$/m); assert(!/FAILURES!!!|INSTRUMENTATION_FAILED|sgm_installations_blocked/.test(local));
  assert.equal((local.match(/^INSTRUMENTATION_STATUS_CODE: 0\s*$/gm) ?? []).length, 11);
  assert.equal((local.match(/^INSTRUMENTATION_STATUS_CODE: 1\s*$/gm) ?? []).length, 11);
  for (const row of cases) assert.equal(local.split('INSTRUMENTATION_STATUS: test=' + row.name + '\n').length - 1, 2);
  assert.deepEqual(json('preparation/local/source-sha256.json'), finalSources);
  const localApks = json('preparation/local/apk-sha256.json');
  assert.equal(localApks['android/app/build/outputs/apk/debug/app-debug.apk'], apk.sha256);
  assert.equal(localApks['android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'],
    'd49ca8dffcb9e97710ec0fc1b68e239f6b05f6eaa973c0edd72a1d354db32fbb');
  assert.equal(localClosure.scope, 'local-native-component-debug-not-guarded-ci-or-physical-proof');
  for (const key of ['storeRestored', 'storeVerificationPassed', 'appsUninstalled']) assert.equal(localClosure[key], true, key);
  for (const key of ['productionWritesAccepted', 'installationPolicyChanged']) assert.equal(localClosure[key], false, key);
  assert.deepEqual(localClosure.processResult, {status: 0, signal: null, errorCode: null});
  assert.deepEqual(json('preparation/local/process.json'), localClosure.processResult);
  const localRestore = json('preparation/local/store-restoration.json'); assert.equal(localRestore.restored, true); assert.equal(localRestore.verified, true);
  const localDisposal = json('preparation/local/disposal.json');
  for (const key of ['ownedAvdAbsent', 'ownedDeviceAbsent', 'emulatorPortRefused', 'appsAbsentBeforeShutdown']) assert.equal(localDisposal[key], true, key);
  assert.equal(localDisposal.emulatorExitCode, 0); assert.equal(localDisposal.physicalDeviceAccepted, false); assert.equal(localDisposal.releaseAccepted, false);
  const original = json('original-attempt/interruption.json'), originalBefore = json('original-attempt/before.json');
  assert.equal(originalBefore.runId, original.runId); assert.equal(originalBefore.phase, 'before');
  assert.deepEqual(original.completedRecordPhases, ['before']);
  verifySessionRestorationRecords(json('original-attempt/baseline.json'), originalBefore.state);
  for (const key of ['originalExitCodesObserved', 'authenticatedPhoneObserved', 'datePickerExercised', 'providerSessionEndedByAgent',
    'phoneUninstallIndependentlyVerified', 'originalClipboardRestorationVerified', 'interruptionCauseEstablished', 'releaseAccepted'])
    assert.equal(original[key], false, key);
  assert.equal(original.privateFixtureCredentialRemoved, true); assert.equal(original.mapRequests, 0);
  const phone = json('phone/results.json'), after = json('phone/failure-state.json');
  assert.equal(phone.scope, 'independent-search-departure-records-not-phone-ui-or-search-results');
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.completed, false); assert.equal(phone.failure, false);
  assert.notEqual(phone.runId, original.runId); assert.deepEqual(phone.checkpoints.map(row => row.phase), ['before']);
  const before = json('phone/before.json'); assert.equal(before.runId, phone.runId);
  verifySessionRestorationRecords(json('phone/baseline.json'), before.state);
  assert.equal(after.runId, phone.runId); assert.equal(after.projectId, phone.projectId);
  assert.deepEqual(verifySessionRestorationRecords(json('phone/baseline.json'), after.state), after.isolation);
  for (const report of [phone, after]) {
    assertRetainedSourceFiles(root, report.sourceFiles);
    assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
    assert.equal(report.searchSubmitted, false); assert.equal(report.productionWrites, false);
  }
  for (const key of ['completedPhoneFlow', 'calendarReached', 'realPaymentExercised', 'errorCauseEstablished']) assert.equal(after[key], false, key);
  assert.equal(after.mapRequests, 0);
  const capture = json('phone/captures/auth-timeout-capture.json');
  assert.equal(capture.phase, 'authentication-timeout-before-calendar'); assert.equal(capture.published, false);
  assert.equal(capture.scope, 'session-window-crop-not-native-export'); assert.equal(capture.crop.scaled, false);
  for (const [file, digest, width, height] of [['auth-timeout-session.jpg', capture.source.sha256, 1200, 596],
    ['auth-timeout.png', capture.crop.sha256, 198, 439]]) {
    const value = bytes('phone/captures/' + file); assert.equal(sha(value), digest);
    assert.deepEqual([imageSize(value).width, imageSize(value).height], [width, height]);
  }
  assert.deepEqual([capture.crop.left, capture.crop.top], [460, 108]);
  const disposal = json('phone/disposal.json'), phoneDisposal = json('phone/phone-disposal.json');
  assert.deepEqual(disposal.closedPorts, [5001, 8080, 9000, 9099, 51300]);
  for (const key of ['ownedRuntimeDirectoryAbsent', 'ownedHelperDirectoryAbsent', 'fixtureCredentialAbsent', 'ownedProcessesAbsent'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.helperExitCode, 130); assert.equal(disposal.backendExitCode, 130);
  for (const key of ['sessionEndedByAgent', 'uploadedAppsDashboardObserved', 'uninstallAcknowledged']) assert.equal(phoneDisposal[key], true, key);
  for (const key of ['packageAbsenceIndependentlyVerified', 'inAppSignOutVerified', 'devicePolicyChanged', 'planChanged'])
    assert.equal(phoneDisposal[key], false, key);
  assert.equal(json('phone/uninstall-observation.json').acknowledgment, 'Succesfully uninstalled your app(s)!');
  assert.equal(json('preparation/initial-state-check.json').rawStderrRetained, false);
  const review = json('review.json');
  assert.equal(review.scope, 'search-date-time-component-ui-and-failed-physical-auth-not-complete-search-or-release');
  assert.equal(review.sourceCommit, searchDepartureCandidate); assert.equal(review.reviewedAt, '2026-10-31');
  assert.equal(review.nativeRunId, run.id); assert.equal(review.nativeJobId, job.id);
  assert.equal(review.nativeWorkflowSucceeded, run.conclusion === 'success'); assert.equal(review.nativeMainJobSucceeded, job.conclusion === 'success');
  assert.equal(review.supersededRunsAccepted, false);
  assert.equal(review.unitCasesPassed, 10); assert.equal(review.newNativeCasesPassed, 9); assert.equal(review.migratedNativeCasesPassed, 2);
  assert.equal(review.supplementalLocalNativeCasesPassed, 11); assert.equal(review.supplementalLocalGuardConfirmed, false);
  assert.deepEqual(review.phoneAuthenticationObservation, {visibleMessage: 'E-mail ou mot de passe incorrect.',
    originalCapturePhase: 'authentication-timeout-before-calendar', originalLabelIsDiagnosis: false,
    underlyingErrorCodeObserved: false, typedSecretIndependentlyVerified: false});
  for (const key of ['physicalDateChoiceAccepted', 'physicalSearchRecoveryAccepted', 'physicalBookingRecoveryAccepted',
    'authenticationFailureCauseEstablished', 'authenticationTimeoutEstablished', 'previousCaptureFailureRepaired', 'iOSUiAccepted', 'realMapsExercised',
    'realPaymentsExercised', 'productionWrites', 'screenReaderAccepted', 'releaseAccepted', 'fullNativeGateAccepted',
    'offlineChatSequenceAccepted', 'networkPreparationCauseEstablished']) assert.equal(review[key], false, key);
  assert.equal(review.mapRequests, 0); assert.deepEqual(review.publishedCaptures, []);
  assert.deepEqual(review.privateHelperScope, {ports: [5001, 8080, 9000, 9099], forceLocal: false, aliasEnabled: false,
    invitationPagePortEnabled: false, requestLoggingEnabled: false});
  return {unitCasesPassed: 10, selectedNativeCasesPassed: 11, physicalDateChoiceAccepted: false, releaseAccepted: false};
}
