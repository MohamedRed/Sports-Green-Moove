import {reviewRecoveryImages} from './review-submission-recovery.mjs';
import {reviewNetworkImages} from './review-network-phone.mjs';
import {reviewReceiptImages} from './review-receipt-phone.mjs';
import {reviewReplayImages} from './review-context-replay.mjs';
import {reviewContextPhoneImages} from './review-context-phone.mjs';
import {reviewTripImages} from './review-trip-context.mjs';
import {reviewDisplayImage} from './review-display-recovery.mjs';
import {reviewPaginationImages} from './review-pagination.mjs';
import {receivedRatingImages} from './received-ratings.mjs';
import {reviewHistoryPhoneImages} from './review-history-phone.mjs';

export function createRatingsFlow(local, rideUi, shot) {
  return {id: 'ratings', title: 'Avis après trajet', status: 'partial', checkedAt: '2026-10-30', latestEvidence: 'phone',
    summary: 'Reconnaître le trajet, donner un avis et voir sa moyenne.',
    verified: 'Une confirmation perdue ne crée pas de doublon. L’avis reste enregistré après fermeture complète. Le conducteur voit la moyenne et le nombre d’avis.',
    remaining: 'Vérifier sur iPhone et avec une coupure pendant un vrai déplacement.',
    ui: {...rideUi(['ride-review-ui']), checkedAt: '2026-10-15'},
    local: local(['ratings'], ['L’avis du parent est enregistré.', 'Le même avis ne peut pas être envoyé deux fois.',
      'La demande d’avis disparaît après envoi.', 'Une personne extérieure ne peut pas noter ce trajet.'],
    'docs/release/evidence/local-2026-10-15/results.json', '2026-10-15'),
    images: [...reviewReceiptImages, ...reviewNetworkImages, ...reviewRecoveryImages, ...reviewReplayImages, ...reviewContextPhoneImages, ...reviewTripImages, reviewDisplayImage,
      ...reviewPaginationImages, ...receivedRatingImages, ...reviewHistoryPhoneImages,
      shot('ride-phone-review-prompt', 'Demande d’avis sur téléphone le 23 octobre'),
      shot('ride-phone-reviewed', 'Avis confirmé sur téléphone le 23 octobre'),
      shot('ride-review', 'Demande d’avis après le trajet local'), shot('ride-review-sent', 'Avis envoyé et demande retirée, en local')],
    source: 'docs/release/evidence/review-receipt-phone-2026-10-30/README.md'};
}
