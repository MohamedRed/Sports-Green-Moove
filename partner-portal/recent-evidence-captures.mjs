import {appearanceCaptures} from './appearance-flow.mjs';
import {searchDeparturePhoneCaptures} from './search-departure-phone.mjs';
import {chatNetworkPhoneCaptures} from './chat-network-phone.mjs';
import {chatDraftPhoneCaptures} from './chat-draft-phone.mjs';
import {chatDraftReplayCaptures} from './chat-draft-replay-phone.mjs';
import {chatPendingRestartCaptures} from './chat-pending-restart-phone.mjs';
import {accentControlCaptures} from './accent-controls-flow.mjs';
import {tripConsentPhoneCaptures} from './trip-consent-phone.mjs';
import {tripDraftPhoneCaptures} from './trip-draft-phone.mjs';
import {trackingAttemptCaptures} from './tracking-phone-attempt.mjs';
import {trackingClockCaptures} from './tracking-clock-replay.mjs';
import {trackingNetworkCaptures} from './tracking-network-phone.mjs';
import {childAccountPhoneCaptures} from './child-account-phone-attempt.mjs';
import {childAccountPhonePassCaptures} from './child-account-phone-pass.mjs';
import {childInvitationPhoneCaptures} from './child-invitation-phone.mjs';
import {childEmergencyPhoneCaptures} from './child-emergency-phone.mjs';
import {chatNetworkRecoveryCaptures} from './chat-network-recovery.mjs';
import {teamRestartCaptures} from './team-process-restart.mjs';
import {directBookingCaptures} from './direct-booking.mjs';
import {tripCancellationCaptures} from './trip-cancellation-phone.mjs';
import {staleCancellationCaptures} from './cancellation-stale-phone.mjs';
import {reviewHistoryPhoneCaptures} from './review-history-phone.mjs';
import {receivedRatingCaptures} from './received-ratings.mjs';
import {reviewPaginationCaptures} from './review-pagination.mjs';
import {reviewDisplayCaptures} from './review-display-recovery.mjs';
import {reviewTripCaptures} from './review-trip-context.mjs';
import {reviewContextPhoneCaptures} from './review-context-phone.mjs';
import {reviewReplayCaptures} from './review-context-replay.mjs';
import {reviewRecoveryCaptures} from './review-submission-recovery.mjs';
import {reviewNetworkCaptures} from './review-network-phone.mjs';
import {reviewReceiptCaptures} from './review-receipt-phone.mjs';
import {bookingReceiptCaptures} from './booking-receipt-phone.mjs';
import {bookingBeforeAckCaptures} from './booking-before-ack-phone.mjs';

export const recentCaptures = {
  ...chatPendingRestartCaptures,
  ...chatDraftReplayCaptures,
  ...chatDraftPhoneCaptures,
  ...chatNetworkPhoneCaptures,
  ...searchDeparturePhoneCaptures,
  ...accentControlCaptures,
  ...appearanceCaptures,
  ...staleCancellationCaptures,
  ...bookingBeforeAckCaptures,
  ...bookingReceiptCaptures,
  ...reviewNetworkCaptures,
  ...reviewReceiptCaptures,
  ...reviewRecoveryCaptures,
  ...reviewReplayCaptures,
  ...reviewContextPhoneCaptures,
  ...receivedRatingCaptures,
  ...reviewPaginationCaptures,
  ...reviewDisplayCaptures,
  ...reviewTripCaptures,
  ...reviewHistoryPhoneCaptures,
  ...tripCancellationCaptures,
  ...directBookingCaptures,
  ...teamRestartCaptures,
  ...chatNetworkRecoveryCaptures,
  ...childEmergencyPhoneCaptures,
  ...childInvitationPhoneCaptures,
  ...childAccountPhonePassCaptures,
  ...childAccountPhoneCaptures,
  ...tripConsentPhoneCaptures,
  ...tripDraftPhoneCaptures,
  ...trackingAttemptCaptures,
  ...trackingClockCaptures,
  ...trackingNetworkCaptures,
};
