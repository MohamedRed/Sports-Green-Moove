import {reviewRecoveryImages} from './review-submission-recovery.mjs';
import {reviewReplayImages} from './review-context-replay.mjs';
import {reviewContextPhoneImages} from './review-context-phone.mjs';
import {reviewTripImages} from './review-trip-context.mjs';
import {reviewDisplayImage} from './review-display-recovery.mjs';
import {reviewPaginationImages} from './review-pagination.mjs';
import {receivedRatingImages} from './received-ratings.mjs';
import {reviewHistoryPhoneImages} from './review-history-phone.mjs';

export function createRatingsFlow(local, rideUi, shot) {
  return {id: 'ratings', title: 'Avis après trajet', status: 'partial', checkedAt: '2026-10-29', latestEvidence: 'local',
    summary: 'Reconnaître le trajet, donner un avis et voir sa moyenne.',
    verified: 'Les avis et la moyenne restent après relancement. En simulation, un envoi interrompu conserve le trajet et se reprend sans doublon.',
    remaining: 'Revoir le trajet concerné après coupure et reconnexion réseau sur téléphone réel, puis sur iPhone.',
    ui: {...rideUi(['ride-review-ui']), checkedAt: '2026-10-15'},
    local: local(['ratings'], ['L’avis du parent est enregistré.', 'Le même avis ne peut pas être envoyé deux fois.',
      'La demande d’avis disparaît après envoi.', 'Une personne extérieure ne peut pas noter ce trajet.'],
    'docs/release/evidence/local-2026-10-15/results.json', '2026-10-15'),
    images: [...reviewRecoveryImages, ...reviewReplayImages, ...reviewContextPhoneImages, ...reviewTripImages, reviewDisplayImage,
      ...reviewPaginationImages, ...receivedRatingImages, ...reviewHistoryPhoneImages,
      shot('ride-phone-review-prompt', 'Demande d’avis sur téléphone le 23 octobre'),
      shot('ride-phone-reviewed', 'Avis confirmé sur téléphone le 23 octobre'),
      shot('ride-review', 'Demande d’avis après le trajet local'), shot('ride-review-sent', 'Avis envoyé et demande retirée, en local')],
    source: 'docs/release/evidence/review-submission-recovery-2026-10-29/README.md'};
}
