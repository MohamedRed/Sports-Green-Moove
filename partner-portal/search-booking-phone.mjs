const folder = 'docs/release/evidence/search-booking-phone-2026-10-24/';
export const searchBookingPhone = {source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24'};
const image = (phase, alt) => ({file: 'search-phone-' + phase, alt: alt + ', essai sur téléphone du 24 octobre'});
export const searchPhoneImages = [image('choices', 'Adresses, date, Lina et deux places choisies'), image('match', 'Un trajet gratuit trouvé'),
  image('requested', 'Demande de deux places envoyée')];
export const bookingSearchPhoneImages = [image('requested', 'Demande de deux places envoyée'), image('driver-approved', 'Accord du conducteur'),
  image('parent-approved', 'Accord retrouvé par le parent'), image('cancelled', 'Réservation annulée'), image('capacity-restored', 'Quatre places à nouveau disponibles')];
const step = (phase, title, text) => ({image: 'search-phone-' + phase, title, text});
export const searchPhoneTour = [step('choices', 'Choisir son trajet', 'Deux adresses réelles, Lina, deux places et le consentement du parent.'),
  step('match', 'Trouver un trajet', 'Le trajet gratuit attendu apparaît avec quatre places.'),
  step('requested', 'Envoyer la demande', 'Une seule demande de deux places est enregistrée pour Lina.')];
export const bookingSearchPhoneTour = [step('requested', 'Demander deux places', 'Le parent envoie la demande pour Lina.'),
  step('driver-approved', 'Donner son accord', 'Le conducteur approuve la même réservation.'),
  step('parent-approved', 'Retrouver la réponse', 'Le parent voit l’accord après reconnexion.'),
  step('cancelled', 'Annuler la réservation', 'Le parent confirme l’annulation du trajet gratuit.'),
  step('capacity-restored', 'Restituer les places', 'Le trajet retrouve ses quatre places. Aucun paiement réel.')];
export const searchPhoneProgress = [{date: '2026-10-24', title: 'Deux places réservées pour Lina, sur téléphone',
  text: 'Recherche avec de vraies adresses, demande, accord et annulation réussis. Les quatre places reviennent. Sept captures ajoutées, avec des comptes de test.',
  flow: 'search', coversFlows: ['booking'], source: folder + 'README.md'}];
