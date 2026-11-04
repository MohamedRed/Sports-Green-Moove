import {appearanceProgress} from './appearance-flow.mjs';
import {feedbackVisualProgress} from './feedback-text-visual-flow.mjs';
import {bookingDateProgress} from './booking-date-attempt.mjs';
import {bookingDateVisualProgress} from './booking-date-visual-flow.mjs';
import {formFeedbackVisualProgress} from './form-feedback-visual-flow.mjs';
import {paymentReturnIncidentProgress} from './payment-return-incident.mjs';
import {compatibleSecurityProgress} from './compatible-security-patches.mjs';
import {androidCutoffProgress} from './android-cutoff-recheck.mjs';
import {nativeCopyProgress} from './native-copy-recheck.mjs';
import {iosMvpProgress} from './ios-mvp-baseline.mjs';
import {iosSearchSafetyProgress} from './ios-search-safety.mjs';
import {iosFixtureProgress, iosFixtureLaunchProgress} from './ios-fixture-observation.mjs';
import {iosAccountRefreshProgress} from './ios-account-refresh.mjs';
import {iosFixturePassProgress} from './ios-fixture-pass.mjs';
import {iosAuthenticationProgress} from './ios-authentication.mjs';
import {iosProfileInitializationProgress} from './ios-profile-initialization.mjs';
import {iosLocationStopProgress} from './ios-location-stop.mjs';
import {iosProfileFixtureResultProgress} from './ios-profile-fixture-result.mjs';
import {feedbackTextProgress} from './feedback-text-progress.mjs';
import {webFinalizationProgress} from './web-finalization-followup.mjs';
import {c84ChecksProgress} from './c84-checks.mjs';
import {approvedPrivateTrialProgress} from './approved-private-trials.mjs';
import {parentApprovalInputStopProgress} from './parent-approval-input-stop.mjs';
import {focusedCopyFailureProgress} from './focused-copy-failure.mjs';
import {chatPreparationFailureProgress} from './chat-preparation-failure.mjs';
import {completeChecksProgress} from './complete-checks.mjs';
import {invitationAliasProgress} from './invitation-alias-phone.mjs';
import {notificationRemovalProgress} from './toolchain-notification-recheck.mjs';
import {chatReceiptProgress} from './chat-receipt-loss-phone.mjs';
import {networkPreparationProgress as pairedNetworkPreparationProgress} from './network-preparation-recheck.mjs';
import {chatRgbProgress} from './chat-proof-rgb-normalization.mjs';
import {teamPushAlertProgress} from './team-push-alert.mjs';
import {teamPushNativeConsumerProgress} from './team-push-native-consumer.mjs';
import {nativeAlertFirstRunProgress} from './native-alert-first-run.mjs';
import {teamPushDispatchProgress,remoteTeardownProgress} from './team-push-dispatch.mjs';
import {foregroundReturnIntentProgress} from './foreground-return-intent.mjs';
import {pushCleanupProgress,foregroundReturnPassProgress} from './push-cleanup-and-return.mjs';
import {alertCaptureFailureProgress} from './alert-capture-failure.mjs';
import {notificationRetryProgress} from './notification-retry-phone.mjs';
import {notificationSamplingProgress} from './notification-sampling.mjs';
import {teamPushRegistrationProgress} from './team-push-registration.mjs';
import {teamPushJournalProgress} from './team-push-journal.mjs';
import {teamPushLifecycleProgress} from './team-push-lifecycle.mjs';
import {teamPushNativeGateProgress} from './team-push-native-gate.mjs';
import {teamPushSignOutProgress} from './team-push-signout.mjs';
import {nativeNetworkPreparationProgress} from './native-network-preparation.mjs';
import {teamPushSignOutConnectedProgress} from './team-push-signout-connected.mjs';
import {teamPushExitGateProgress} from './team-push-exit-gate.mjs';
import {sessionExitComponentsProgress} from './session-exit-components.mjs';
import {notificationGateProgress} from './notification-gate-pass.mjs';
import {notificationInboxPhoneProgress} from './notification-inbox-phone.mjs';
import {chatDraftPhoneProgress} from './chat-draft-phone.mjs';
import {chatDraftReplayProgress} from './chat-draft-replay-phone.mjs';
import {chatPendingRestartProgress} from './chat-pending-restart-phone.mjs';
import {chatAccountSwitchProgress} from './chat-account-switch-phone.mjs';
import {searchDeparturePhoneProgress} from './search-departure-phone.mjs';
import {chatNetworkPhoneProgress} from './chat-network-phone.mjs';
import {transferLifecycleProgress} from './transfer-lifecycle.mjs';
import {disconnectRecheckProgress} from './session-disconnect-recheck.mjs';
import {compressionSecurityProgress} from './compression-security.mjs';
import {uriSecurityProgress} from './uri-security.mjs';
import {transferPeerLossProgress} from './transfer-peer-loss.mjs';
import {nativeCopyFollowupProgress} from './native-copy-followup.mjs';
import {searchDepartureProgress, searchDepartureSequenceProgress} from './search-departure.mjs';
import {tlsAgentSecurityProgress} from './tls-agent-security.mjs';
import {accentControlProgress} from './accent-controls-flow.mjs';
import { tripDraftPhoneProgress } from './trip-draft-phone.mjs';
import { chatNetworkRecoveryProgress, chatNetworkRecheckProgress } from './chat-network-recovery.mjs';
import { scheduleDraftPhoneProgress } from './schedule-draft-phone.mjs';
import { consentRestartPhoneProgress } from './consent-restart-phone.mjs';
import { teamConnectionRecoveryProgress } from './team-connection-recovery.mjs';
import { teamRestartProgress } from './team-process-restart.mjs';
import { directBookingProgress } from './direct-booking.mjs';
import {requestSafetyProgress} from './request-safety.mjs';
import {tripCancellationProgress} from './trip-cancellation-phone.mjs';
import {dependencyPatchProgress, networkPreparationProgress} from './dependency-patch.mjs';
import {nativeGateProgress} from './native-gate-recheck.mjs';
import {publishedMediaProgress} from './published-media-playback.mjs';
import {reviewHistoryProgress} from './review-history.mjs';
import {reviewHistoryPhoneProgress} from './review-history-phone.mjs';
import {receivedRatingProgress, latestNativeFailureProgress} from './received-ratings.mjs';
import {reviewPaginationProgress} from './review-pagination.mjs';
import {reviewDisplayProgress, sessionCurrentProgress} from './review-display-recovery.mjs';
import {reviewTripProgress, reviewBaselineGateProgress} from './review-trip-context.mjs';
import {reviewContextPhoneProgress} from './review-context-phone.mjs';
import {reviewReplayProgress, reviewContextGateProgress} from './review-context-replay.mjs';
import {reviewRecoveryProgress} from './review-submission-recovery.mjs';
import {reviewNetworkProgress} from './review-network-phone.mjs';
import {reviewReceiptProgress} from './review-receipt-phone.mjs';
import {bookingReceiptProgress} from './booking-receipt-phone.mjs';
import {bookingBeforeAckProgress} from './booking-before-ack-phone.mjs';
import {latestChatNetworkProgress} from './chat-network-latest.mjs';
import {nativeFollowupProgress, nativeFollowupGateProgress} from './native-followup.mjs';
import {rejectedCaptureProgress} from './rejected-capture-probe.mjs';
import {testRunnerSecurityProgress} from './test-runner-security.mjs';
import {captureWindowProgress} from './capture-window-calibration.mjs';
import {releaseRecheckProgress} from './release-recheck.mjs';
import {supportRecoveryRecheckProgress, latestCopyRecheckProgress} from './support-recovery-recheck.mjs';
import {childBookingReceiptProgress, latestChatPreparationProgress, latestGeneratedCopyProgress} from './child-booking-receipt.mjs';
import {chatNetworkRepeatProgress} from './chat-network-repeat.mjs';
import {nativeTimeBudgetProgress, nativeBudgetExecutionProgress} from './native-time-budget.mjs';
import {staleCancellationProgress, cancellationBaselineProgress} from './cancellation-stale-phone.mjs';
import {invitationConnectionProgress, nativeCapacityProgress, invitationRecheckProgress} from './preparation-failures.mjs';
import {sessionRecoveryProgress, chatOwnerDraftProgress, recoveryGateProgress} from './session-recovery-recheck.mjs';
import {copyReconnectProgress} from './copy-reconnect.mjs';
import {fullNativePassProgress} from './full-native-pass.mjs';
import {teamAlertProgress} from './team-alerts.mjs';

export const currentProgress = [
  iosProfileFixtureResultProgress,
  iosLocationStopProgress,
  iosProfileInitializationProgress,
  iosAuthenticationProgress,
  iosFixturePassProgress,
  iosAccountRefreshProgress,
  iosFixtureProgress,
  iosFixtureLaunchProgress,
  iosSearchSafetyProgress,
  iosMvpProgress,
  nativeCopyProgress,
  androidCutoffProgress,
  compatibleSecurityProgress,
  paymentReturnIncidentProgress,
  formFeedbackVisualProgress,
  bookingDateVisualProgress,
  bookingDateProgress,
  feedbackVisualProgress,
  feedbackTextProgress,
  webFinalizationProgress,
  c84ChecksProgress,
  uriSecurityProgress,
  parentApprovalInputStopProgress,
  focusedCopyFailureProgress,
  ...approvedPrivateTrialProgress,
  chatPreparationFailureProgress,
  completeChecksProgress,
  invitationAliasProgress,
  chatRgbProgress,
  pairedNetworkPreparationProgress,
  chatReceiptProgress,
  notificationRemovalProgress,
  pushCleanupProgress,
  foregroundReturnPassProgress,
  foregroundReturnIntentProgress,
  teamPushDispatchProgress,
  remoteTeardownProgress,
  nativeAlertFirstRunProgress,
  teamPushNativeConsumerProgress,
  teamPushAlertProgress,
  sessionExitComponentsProgress,
  teamPushExitGateProgress,
  teamPushSignOutConnectedProgress,
  nativeNetworkPreparationProgress,
  teamPushSignOutProgress,
  teamPushNativeGateProgress,
  teamPushLifecycleProgress,
  teamPushJournalProgress,
  teamPushRegistrationProgress,
  notificationGateProgress,
  notificationRetryProgress,
  notificationSamplingProgress,
  alertCaptureFailureProgress,
  notificationInboxPhoneProgress,
  teamAlertProgress,
  chatAccountSwitchProgress,
  chatPendingRestartProgress,
  fullNativePassProgress,
  copyReconnectProgress,
  invitationRecheckProgress,
  sessionRecoveryProgress,
  chatOwnerDraftProgress,
  recoveryGateProgress,
  chatDraftReplayProgress,
  chatDraftPhoneProgress,
  {date: '2026-10-31', title: 'L’invitation enfant repasse les contrôles locaux',
    text: 'Création du compte et accord séparé du parent : les 18 contrôles passent. L’ouverture du lien sur téléphone reste à débloquer.',
    flow: 'child-emergency', source: 'docs/release/evidence/child-invitation-recheck-2026-10-31/README.md'},
  transferPeerLossProgress,
  compressionSecurityProgress,
  disconnectRecheckProgress,
  transferLifecycleProgress,
  chatNetworkPhoneProgress,
  searchDeparturePhoneProgress,
  nativeCopyFollowupProgress,
  searchDepartureProgress,
  searchDepartureSequenceProgress,
  tlsAgentSecurityProgress,
  accentControlProgress,
  appearanceProgress,
  invitationConnectionProgress,
  nativeCapacityProgress,
  staleCancellationProgress,
  cancellationBaselineProgress,
  nativeBudgetExecutionProgress,
  nativeTimeBudgetProgress,
  chatNetworkRepeatProgress,
  childBookingReceiptProgress,
  latestChatPreparationProgress,
  latestGeneratedCopyProgress,
  supportRecoveryRecheckProgress,
  latestCopyRecheckProgress,
  releaseRecheckProgress,
  captureWindowProgress,
  testRunnerSecurityProgress,
  rejectedCaptureProgress,
  nativeFollowupGateProgress,
  nativeFollowupProgress,
  latestChatNetworkProgress,
  bookingBeforeAckProgress,
  {date: '2026-10-30', title: 'La coupure du chat reste à rejouer',
    text: 'Le nouvel essai s’arrête pendant la préparation de la connexion, avant la coupure et le renvoi. Cet essai n’est pas validé.',
    flow: 'messages', source: 'docs/release/evidence/chat-network-preparation-4714198/README.md',
    checksums: 'docs/release/evidence/chat-network-preparation-4714198/artifact-sha256.json'},
  bookingReceiptProgress,
  {date: '2026-10-30', title: 'L’échec de capture reste à expliquer',
    text: 'Les essais séparés passent. L’essai complet reste à valider ; les nouveaux relevés serviront à comprendre où il s’arrête.',
    flow: 'native-startup', source: 'docs/release/evidence/capture-late-sampling-2026-10-30/README.md',
    checksums: 'docs/release/evidence/capture-late-sampling-2026-10-30/artifact-sha256.json'},
  reviewReceiptProgress,
  reviewNetworkProgress,
  reviewRecoveryProgress,
  reviewReplayProgress,
  reviewContextGateProgress,
  reviewContextPhoneProgress,
  reviewTripProgress,
  reviewBaselineGateProgress,
  reviewDisplayProgress,
  sessionCurrentProgress,
  reviewPaginationProgress,
  receivedRatingProgress,
  latestNativeFailureProgress,
  reviewHistoryPhoneProgress,
  reviewHistoryProgress,
  publishedMediaProgress,
  nativeGateProgress,
  chatNetworkRecheckProgress,
  dependencyPatchProgress,
  networkPreparationProgress,
  tripCancellationProgress,
  requestSafetyProgress,
  directBookingProgress,
  teamRestartProgress,
  teamConnectionRecoveryProgress,
  consentRestartPhoneProgress,
  scheduleDraftPhoneProgress,
  chatNetworkRecoveryProgress,
  { date: '2026-10-27', title: 'Un essai complet s’arrête avant la coupure',
    text: 'Lors de cet essai, une capture de confirmation échoue et la coupure réseau ne démarre pas. Les dix essais séparés passent en simulation.',
    flow: 'native-startup', coversFlows: ['messages', 'team-conversation'],
    source: 'docs/release/evidence/render-network-gate-48ea950-2026-10-27/README.md' },
  tripDraftPhoneProgress,
];
