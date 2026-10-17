import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { verifyLocalRideUi } from './verify-local-ride-ui.mjs';
import { verifyLocalChatUi } from './verify-local-chat-ui.mjs';
import { seedChatDirectoryUiFixtures } from './local-chat-directory-ui-fixtures.mjs';
import { verifyLocalChatDirectoryUi } from './verify-local-chat-directory-ui.mjs';
import { verifyLocalMultiSeatSdk } from './verify-local-multi-seat-sdk.mjs';
import { seedReservationUiFixtures, verifyReservationUi } from './local-reservation-ui.mjs';
import { verifyNativeMembershipUi } from './local-native-membership.mjs';
import { seedChatNetworkUiFixture, verifyChatNetworkUi } from './local-chat-network-ui.mjs';
import { replayWithNetworkCleanup } from './local-network-replay.mjs';
import { finishDisposableCleanup, waitForDisposableDevice } from './disposable-device-cleanup.mjs';
import { seedChatRestartUiFixture, checkpointChatRestart, verifyChatRestartUi } from './local-chat-restart-ui.mjs';
import { stopDisposableChatProcess } from './local-chat-process-stop.mjs';
import { replayChatLossUi } from './local-chat-loss-ui.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { seedTripCancellationUi, verifyTripCancellationUi } from './local-trip-cancellation-ui.mjs';
import { replayNativeBookingLoss } from './local-native-booking-loss.mjs';
import { replayBookingUiLoss } from './local-booking-ui-loss.mjs';
import { seedTripChangeUi, verifyTripChangeUi } from './local-trip-change-ui.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { seedTripChangeInputsUi, verifyTripChangeInputsUi } from './local-trip-change-inputs-ui.mjs';
import { seedTripScheduleUi, verifyTripScheduleUi } from './local-trip-change-schedule-ui.mjs';
import { replayTripConsentRestart } from './local-trip-consent-restart.mjs';

const root = resolve(import.meta.dirname, '../..');
const session = await seedLocalUiFixtures();
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial), 'Physical devices are not supported by this local fixture runner');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const run = (command, args) => execFileSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 20 * 60_000 });
const android = resolve(root, 'android');
run(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
  '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2']);
run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs/apk/debug/app-debug.apk')]);
run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')]);
run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);

function instrument(classes, expected, extraArguments = []) {
  run(adb, ['-s', serial, 'logcat', '-b', 'crash', '-c']);
  const output = execFileSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    ...extraArguments,
    '-e', 'class', classes.map((name) => `be.sportgreenmoove.app.ui.${name}`).join(','),
    'be.sportgreenmoove.app.local.test/androidx.test.runner.AndroidJUnitRunner'],
  { env: process.env, encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  console.log(output.replaceAll(session.password, '[REDACTED]'));
  writeFileSync(resolve(evidenceDir, `${classes.join('-')}-instrumentation.txt`), output.replaceAll(session.password, '[REDACTED]'));
  try { assertInstrumentationPassed(output, expected); }
  catch (failure) {
    try {
      collectNativeProcessFailure({ adb, serial, directory: evidenceDir, label: classes.join('-'),
        password: session.password, runId: session.runId });
    } catch { console.warn('Could not collect the local process-exit diagnostics.'); }
    throw failure;
  }
}

const evidenceDir = process.env.SGM_LOCAL_UI_OUTPUT;
mkdirSync(evidenceDir, { recursive: true });
const collectEvidence = (phase) => collectLocalUiEvidence({ adb, serial, evidenceDir, phase,
  runId: session.runId, password: session.password });
let capturesCollected = false;
let failure;
let result;
try {
  instrument(['LocalAppFlowTest', 'LocalDriverFlowTest', 'LocalLandscapeLoginTest', 'LocalUiRegressionTest', 'SearchSessionFlowTest', 'SearchCriteriaFlowTest'], 9);
  instrument(['LocalThemeRestartTest'], 1);
  instrument(['LocalMultiSeatSdkTest'], 1);
  const multiSeatSdk = await verifyLocalMultiSeatSdk(session.multiSeatTripId);
  const bookingResponseLoss = await replayNativeBookingLoss({ instrument, collect: () => collectEvidence('booking-response-loss'),
    directory: evidenceDir, adb, serial, runId: session.runId });
  const bookingUiResponseLoss = await replayBookingUiLoss({ instrument, collect: () => collectEvidence('booking-ui-response-loss'),
    directory: evidenceDir, runId: session.runId });
  for (const permission of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'POST_NOTIFICATIONS']) {
    run(adb, ['-s', serial, 'shell', 'pm', 'grant', 'be.sportgreenmoove.app.local', `android.permission.${permission}`]);
  }
  run(adb, ['-s', serial, 'shell', 'appops', 'set', 'be.sportgreenmoove.app.local', 'android:mock_location', 'allow']);
  instrument(['LocalRideFlowTest'], 1);
  const ride = await verifyLocalRideUi();
  instrument(['LocalChatFlowTest'], 1);
  const chat = await verifyLocalChatUi();
  const directoryFixture = await seedChatDirectoryUiFixtures();
  instrument(['LocalConversationDirectoryFlowTest'], 1);
  const directory = await verifyLocalChatDirectoryUi(directoryFixture);
  const reservationFixture = await seedReservationUiFixtures();
  instrument(['LocalBookingDecisionsFlowTest'], 1);
  const reservationDecisions = await verifyReservationUi(reservationFixture);
  const cancellationFixture = await seedTripCancellationUi();
  instrument(['LocalTripCancellationFlowTest'], 1, [
    '-e', 'cancellationTripId', cancellationFixture.tripId,
    '-e', 'cancellationPaidId', cancellationFixture.paidId,
    '-e', 'cancellationPendingId', cancellationFixture.pendingId,
  ]);
  const tripCancellation = await verifyTripCancellationUi(cancellationFixture);
  const tripChangeFixture = await seedTripChangeUi();
  const { confirmed, declined, withdrawn } = tripChangeFixture.fixtures;
  instrument(['LocalTripChangeFlowTest'], 1, [
    '-e', 'tripChangeConfirmedId', confirmed.tripId, '-e', 'tripChangeDeclinedId', declined.tripId,
    '-e', 'tripChangeWithdrawnId', withdrawn.tripId, '-e', 'tripChangeFirstBooking', confirmed.bookingIds[0],
    '-e', 'tripChangeSecondBooking', confirmed.bookingIds[1], '-e', 'tripChangeRefusedBooking', declined.bookingIds[0],
    '-e', 'tripChangeSecondParentEmail', tripChangeFixture.secondParent.email,
  ]);
  collectEvidence('trip-change-parent-confirmation');
  const tripChanges = await verifyTripChangeUi(tripChangeFixture, evidenceDir, session.runId);
  const tripInputsFixture = await seedTripChangeInputsUi();
  instrument(['LocalTripChangeInputsFlowTest'], 1, [
    '-e', 'tripInputsTripId', tripInputsFixture.tripId, '-e', 'tripInputsBookingId', tripInputsFixture.bookingId,
    '-e', 'tripInputsOriginalDeparture', tripInputsFixture.originalDepartureAt,
    '-e', 'tripInputsProposedDeparture', tripInputsFixture.proposedDepartureAt,
  ]);
  collectEvidence('trip-change-inputs');
  const tripChangeInputs = await verifyTripChangeInputsUi(tripInputsFixture, evidenceDir, session.runId);
  const scheduleFixture = await seedTripScheduleUi();
  instrument(['LocalTripChangeScheduleFlowTest'], 1, [
    '-e', 'tripScheduleTripId', scheduleFixture.tripId, '-e', 'tripScheduleBookingId', scheduleFixture.bookingId,
    '-e', 'tripScheduleOriginalDeparture', scheduleFixture.originalDepartureAt,
    '-e', 'tripScheduleProposedDeparture', scheduleFixture.proposedDepartureAt,
    '-e', 'tripScheduleDesiredArrival', scheduleFixture.desiredArrivalBy,
    '-e', 'tripSchedulePastDeparture', scheduleFixture.pastDepartureAt,
  ]);
  collectEvidence('trip-change-schedule');
  const tripSchedule = await verifyTripScheduleUi(scheduleFixture, evidenceDir, session.runId);
  const tripConsentRestart = await replayTripConsentRestart({ instrument, adb, serial, directory: evidenceDir, runId: session.runId,
    collect: () => collectEvidence('trip-consent-restart') });
  instrument(['LocalMembershipFlowTest'], 1);
  const membershipRefresh = await verifyNativeMembershipUi();
  const restartFixture = await seedChatRestartUiFixture();
  instrument(['LocalChatProcessRestartTest#prepareConfirmedConversation'], 1);
  const restartCheckpoint = await checkpointChatRestart(restartFixture, evidenceDir);
  stopDisposableChatProcess(adb, serial, session.runId, evidenceDir);
  instrument(['LocalChatProcessRestartTest#reopenConfirmedConversation'], 1);
  collectEvidence('confirmed-restart');
  const chatRestart = await verifyChatRestartUi(restartFixture, restartCheckpoint, evidenceDir);
  const chatResponseLoss = await replayChatLossUi(instrument, () => collectEvidence('response-loss'), evidenceDir);
  const networkFixture = await seedChatNetworkUiFixture();
  replayWithNetworkCleanup(adb, serial, session.runId, instrument);
  collectEvidence('network-recovery');
  capturesCollected = true;
  const chatNetwork = await verifyChatNetworkUi(networkFixture, evidenceDir);
  const steps = ['parent-app-ui', 'driver-approval-ui', 'landscape-login-ui', 'calendar-empty-consent-ui', 'theme-process-restart-ui',
    'ride-lifecycle-ui', 'ride-review-ui', 'ride-ledgers-ui', 'chat-conversation-ui', 'chat-directory-ui',
    'search-input-ui', 'search-session-ui', 'search-criteria-ui', 'search-retention-ui', 'multi-seat-sdk', 'reservation-decisions-ui',
    'membership-refresh-ui', 'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui',
    'chat-post-commit-response-loss-ui', 'driver-trip-cancellation-ui', 'booking-post-commit-response-loss-sdk', 'booking-response-loss-search-ui',
    'trip-change-parent-confirmation-ui', 'trip-change-inputs-ui', 'trip-change-schedule-ui', 'trip-consent-process-restart-ui']
    .map((id) => ({ id, status: 'passed' }));
  result = { projectId: session.projectId,
    runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), scope: 'local-ui-not-physical-device',
    testCount: 28, steps, ride, chat, directory, multiSeatSdk, reservationDecisions, tripCancellation, tripChanges, tripChangeInputs, tripSchedule,
    tripConsentRestart, membershipRefresh,
    chatNetwork, chatRestart, chatResponseLoss, bookingResponseLoss, bookingUiResponseLoss,
    search: { method: 'component-ui-with-explicit-fake-gateway',
      caseCount: 4, limitation: 'The four search UI cases use explicit fake gateways and host identity/navigation changes, not real provider matching.' },
    limits: ['Synthetic mock positions and pre-granted emulator permissions only.',
      'No physical GPS tracking, provider payments, push delivery or live data tested.'] };
} catch (error) { failure = error; }
finally {
  finishDisposableCleanup(failure, [
    () => {
      if (capturesCollected) return;
      collectEvidence('failure-cleanup');
    },
    () => {
      waitForDisposableDevice(adb, serial);
      run(adb, ['-s', serial, 'shell', 'appops', 'set', 'be.sportgreenmoove.app.local', 'android:mock_location', 'default']);
    },
    () => {
      waitForDisposableDevice(adb, serial);
      run(adb, ['-s', serial, 'shell', 'run-as', 'be.sportgreenmoove.app.local', 'rm', '-f', 'files/local-qa-session.json']);
    },
  ]);
}
assert(result, 'A complete verified replay is required before recording success');
writeFileSync(resolve(evidenceDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
