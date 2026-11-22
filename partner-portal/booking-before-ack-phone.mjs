const folder = 'docs/release/evidence/booking-before-ack-phone-2026-10-30/';
export const bookingBeforeAckPhone = {source: folder + 'summary.json', checkedAt: '2026-10-30', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['receipt-lost', 'La confirmation manque avant de fermer l’app'],
  ['reopened-pending', 'Après fermeture complète, la demande est retrouvée sans nouvel envoi'],
  ['other-card', 'La même demande est retrouvée dans Mes trajets'],
  ['reservation-list', 'Une seule demande adulte apparaît dans les réservations'],
];
export const bookingBeforeAckImages = images.map(([name, label]) => ({file: 'booking-before-ack-' + name,
  alt: label + ', capture de session du 30 octobre, comptes de test'}));
export const bookingBeforeAckCaptures = Object.fromEntries(images.map(([name]) =>
  ['booking-before-ack-' + name, folder + 'captures/' + name + '.jpg']));
export const bookingBeforeAckProgress = {date: '2026-10-30', title: 'Une demande retrouvée même sans confirmation',
  text: 'L’app est fermée avant que la confirmation arrive. Au retour, la même demande est en attente, sans nouvel envoi. Comptes de test.',
  flow: 'booking', source: folder + 'README.md'};
