import {appearanceProgress} from './appearance-flow.mjs';
import {searchDeparturePhoneProgress} from './search-departure-phone.mjs';
import {chatNetworkPhoneProgress} from './chat-network-phone.mjs';
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
import {invitationConnectionProgress, nativeCapacityProgress} from './preparation-failures.mjs';

export const currentProgress = [
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
