import {searchBookingPhone, bookingSearchPhoneImages} from './search-booking-phone.mjs';

export function createBookingFlow(local, shot) {
  return { id: 'booking', title: 'Réservations', status: 'partial', checkedAt: '2026-10-24', latestEvidence: 'phone',
    summary: 'Deux places demandées, approuvées puis annulées sur téléphone.',
    verified: 'Le parent réserve pour Lina, le conducteur approuve, puis le parent retrouve l’accord et annule. Les quatre places reviennent. Comptes et trajet gratuit de test.',
    remaining: 'Restent les réponses perdues, la reprise après fermeture, deux téléphones en même temps, les changements de trajet, les alertes hors de l’app et les remboursements. Pas encore en ligne.',
    searchBookingPhone,
    requestNoticePhone: { source: 'docs/release/evidence/booking-request-phone-2026-10-23/results.json', checkedAt: '2026-10-23',
      checksums: 'docs/release/evidence/booking-request-phone-2026-10-23/artifact-sha256.json' },
    decisionPhone: { source: 'docs/release/evidence/booking-decisions-phone-2026-10-22/results.json', checkedAt: '2026-10-22',
      checksums: 'docs/release/evidence/booking-decisions-phone-2026-10-22/artifact-sha256.json' },
    searchBookingUi: { source: 'docs/release/evidence/parent-search-booking-native-2026-10-20/search-booking-results.json', checkedAt: '2026-10-20' },
    noticeChecks: { source: 'docs/release/evidence/booking-notice-atomicity-2026-10-21/after.json', checkedAt: '2026-10-21' },
    requestNoticeChecks: { source: 'docs/release/evidence/booking-request-notices-2026-10-23/services.json', checkedAt: '2026-10-23',
      checksums: 'docs/release/evidence/booking-request-notices-2026-10-23/artifact-sha256.json' },
    local: local(['booking-cancellation', 'last-seat-concurrency', 'multi-seat-booking', 'reservation-decisions', 'trip-capacity-ownership'], ['Une demande de deux places garde le bon nombre de places.', 'L’annulation restitue les places une seule fois.', 'Le refus ne retire aucune place.', 'Une personne extérieure ne peut pas modifier la réservation.', 'Un passager déjà pris en charge ne peut pas annuler.', 'Le conducteur ne peut pas modifier directement le nombre de places réservées.'], 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json', '2026-10-17'),
    ui: { source: 'docs/release/evidence/local-booking-search-feedback-2026-10-17/results.json', checkedAt: '2026-10-17', groups: ['booking-response-loss-search-ui'] },
    phone: { source: 'docs/release/evidence/browserstack-isolated-booking-2026-10-18/results.json', checkedAt: '2026-10-18' },
    images: [...bookingSearchPhoneImages, ...['parent-request-sent', 'driver-unread', 'driver-read', 'parent-returned', 'driver-returned']
      .map(id => shot('booking-request-phone-' + id, 'Essai sur téléphone du 23 octobre : ' + ({
        'parent-request-sent': 'demande gratuite d’une place envoyée par le parent',
        'driver-unread': 'nouvelle demande reçue par le conducteur, sur le téléphone de remplacement',
        'driver-read': 'alerte marquée comme lue', 'parent-returned': 'retour au parent, sans l’alerte du conducteur',
        'driver-returned': 'alerte toujours lue après reconnexion du conducteur',
      })[id])), ...['prepared', 'approved', 'declined', 'parent-inbox', 'parent-capacity', 'cancelled', 'restored-capacity', 'driver-inbox']
      .map(id => shot('booking-decision-phone-' + id, 'Réservation de deux places, essai sur téléphone du 22 octobre : ' + ({
        prepared: 'demandes en attente', approved: 'accord du conducteur', declined: 'demande refusée',
        'parent-inbox': 'réponses reçues par le parent', 'parent-capacity': 'deux places disponibles après l’accord',
        cancelled: 'annulation du parent', 'restored-capacity': 'quatre places à nouveau disponibles', 'driver-inbox': 'annulation reçue par le conducteur',
      })[id])), shot('search-booking-requested', 'Demande de deux places pour Lina, essai local du 20 octobre'),
      shot('search-booking-driver-approved', 'Accord dans le compte conducteur, essai local du 20 octobre'),
      shot('search-booking-cancelled', 'Annulation par le parent et deux places restituées, essai local du 20 octobre'),
      shot('phone-booking-requested', 'Demande d’une place sur téléphone, avec données de test, le 18 octobre'),
      shot('phone-booking-approved', 'Accord retrouvé après actualisation sur téléphone, le 18 octobre'),
      shot('phone-booking-cancelled', 'Réservation annulée depuis le téléphone, sans paiement, le 18 octobre'),
      shot('booking-retry-unconfirmed', 'Réponse perdue : le parent peut réessayer, essai local du 17 octobre'),
      shot('booking-retry-confirmed', 'Une seule demande envoyée après le renvoi, essai local du 17 octobre'),
      shot('reservation-cancelled', 'Deux réservations annulées par le parent, essai local du 16 octobre'),
      shot('reservation-declined', 'Demande refusée par le conducteur, essai local du 16 octobre'),
      shot('local-approved', 'Demande acceptée lors de l’essai du 15 octobre'),
      shot('booking-review-required', 'Trajet modifié : nouvelle recherche demandée, essai local simulé du 17 octobre'),
      shot('booking-review-narrow', 'Même message en texte agrandi, essai local simulé du 17 octobre')],
    source: 'docs/release/evidence/search-booking-phone-2026-10-24/README.md' };
}
