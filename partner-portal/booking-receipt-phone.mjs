const folder = 'docs/release/evidence/booking-receipt-phone-2026-10-30/';
export const bookingReceiptPhone = {source: folder + 'summary.json', checkedAt: '2026-10-30', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['receipt-lost', 'La demande est enregistrée, mais sa confirmation n’arrive pas'],
  ['confirmed', 'Réessayer confirme la même demande, sans doublon'],
  ['process-restarted', 'La demande revient après fermeture complète'],
  ['other-card', 'Le même résultat est retrouvé depuis Mes trajets'],
  ['reservation-list', 'La réservation apparaît une seule fois dans la liste'],
];
export const bookingReceiptImages = images.map(([name, label]) => ({file: 'booking-receipt-phone-' + name,
  alt: label + ', capture de session du 30 octobre, comptes de test'}));
export const bookingReceiptCaptures = Object.fromEntries(images.map(([name]) =>
  ['booking-receipt-phone-' + name, folder + 'captures/' + name + '.jpg']));
export const bookingReceiptProgress = {date: '2026-10-30', title: 'Réessayer ne crée pas une deuxième réservation',
  text: 'La confirmation se perd, puis Réessayer retrouve la même demande. Elle reste en attente après fermeture complète, depuis l’accueil et Mes trajets. Comptes de test.',
  flow: 'booking', source: folder + 'README.md'};
