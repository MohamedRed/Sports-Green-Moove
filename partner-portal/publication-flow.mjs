import {tripConsentPhone, tripConsentPhoneImages} from './trip-consent-phone.mjs';
import { captureInvestigation } from './capture-observations.mjs';
import { tripDraftPhone, tripDraftPhoneImages } from './trip-draft-phone.mjs';
import { scheduleDraftPhone } from './schedule-draft-phone.mjs';

export function createPublicationFlow(local, shot) {
  return { id: 'publication', title: 'Publication, modification et annulation', status: 'partial', checkedAt: '2026-10-28', latestEvidence: 'phone',
      summary: 'Le brouillon est conservé après fermeture complète de l’app.',
      verified: 'Horaires retrouvés après l’arrêt complet. Prix et adresses aussi. Deux parents acceptent séparément ; refus et retrait vérifiés. L’autre trajet reste intact. Comptes de test.',
      remaining: 'Rejouer l’application du changement et la carte sur téléphone. Terminer les paiements et remboursements réels. Pas encore en ligne.',
      scheduleDraftPhone,
      tripDraftPhone,
      tripConsentPhone,
      captureInvestigation,
      local: local(['publication', 'trip-cancellation', 'trip-details-ownership', 'trip-change-parent-confirmation', 'trip-change-application'], ['Le conducteur publie ; le parent retrouve le trajet.', 'L’annulation ferme les réservations et prévient les parents.', 'Répéter une demande ne crée aucun doublon.', 'Deux parents confirment séparément les détails proposés.', 'Un refus conserve le trajet initial et ses réservations.', 'Après accord, les nouveaux horaire, parcours et prix sont enregistrés.', 'Une réponse perdue est retrouvée sans recréer la proposition.', 'Un supplément ou remboursement non réglé bloque le départ.', 'Aucun paiement ni remboursement réel dans ces essais.'], 'docs/release/evidence/local-trip-change-native-2026-10-17/services.json', '2026-10-17'),
      ui: { source: 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json', checkedAt: '2026-10-18', groups: ['driver-trip-cancellation-ui', 'trip-change-parent-confirmation-ui', 'trip-change-inputs-ui', 'trip-change-schedule-ui', 'trip-consent-process-restart-ui', 'trip-consent-pending-restart-ui', 'trip-consent-partial-restart-ui', 'trip-consent-declined-restart-ui', 'trip-consent-withdrawn-restart-ui'] },
      images: [...tripDraftPhoneImages, ...tripConsentPhoneImages, shot('trip-framed-map-visible', 'Deux repères entièrement visibles, nouvel essai local du 18 octobre'),
        shot('trip-framed-route-applied', 'Nouveau parcours appliqué après les deux accords, nouvel essai local du 18 octobre'),
        shot('trip-framed-places-selected', 'Adresses choisies dans le nouvel essai local réussi du 18 octobre'),
        shot('trip-real-map-visible', 'Ancien essai du 18 octobre au matin : repère de départ coupé'),
        shot('trip-real-route-applied', 'Nouveau parcours appliqué après les deux accords, premier essai réussi du 18 octobre'),
        shot('trip-real-places-selected', 'Adresses choisies lors du premier essai local du 18 octobre'),
        shot('trip-schedule-draft-restored', 'Date et arrivée retrouvées après fermeture complète, essai local du 18 octobre'),
        shot('trip-draft-restored', 'Brouillon retrouvé après fermeture complète, essai local du 18 octobre'),
        shot('trip-history-declined', 'Refus retrouvé dans l’historique après fermeture, essai local du 18 octobre'),
        shot('trip-history-withdrawn', 'Retrait retrouvé dans l’historique après fermeture, essai local du 18 octobre'),
        shot('trip-consent-recovery-pending', 'Demande sans réponse après fermeture, essai local du 17 octobre'),
        shot('trip-consent-recovery-partial', 'Un accord sur deux retrouvé après fermeture, essai local du 17 octobre'),
        shot('trip-consent-recovery-closed', 'Refus et retrait : réservations conservées après fermeture, essai local du 17 octobre'),
        shot('trip-consent-restored-parent', 'Accord retrouvé côté parent après fermeture, essai local du 17 octobre'),
        shot('trip-consent-restored-driver', 'Les mêmes prix côté conducteur, essai local du 17 octobre'),
        shot('trip-date-arrival-confirmed', 'Nouvelle date et arrivée souhaitée confirmées par le parent, essai local du 17 octobre'),
        shot('trip-time-confirmed', 'Nouvel horaire confirmé par le parent, essai local du 17 octobre'),
        shot('trip-route-unavailable', 'Itinéraire non confirmé, changement non appliqué, essai local du 17 octobre'),
        shot('trip-consent-first', 'Premier accord sur deux, essai local du 17 octobre'),
        shot('trip-consent-confirmed', 'Deux accords enregistrés, essai local du 17 octobre'),
        shot('trip-consent-refused', 'Refus sans annulation de la réservation, essai local du 17 octobre'),
        shot('trip-consent-withdrawn', 'Proposition retirée, essai local du 17 octobre'),
        shot('trip-cancel-review', 'Réservations concernées avant annulation, essai local du 16 octobre'),
        shot('trip-cancel-confirmed', 'Annulation confirmée en paysage, essai local du 16 octobre'),
        shot('trip-cancel-parent', 'Deux réservations annulées côté parent, essai local du 16 octobre')],
      source: 'docs/release/evidence/real-maps-native-2026-10-18/README.md' };
}
