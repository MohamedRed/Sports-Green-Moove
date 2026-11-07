const directory = 'docs/release/evidence/direct-booking-confirmation-2026-10-28/';
const steps = [
  ['opened-no-write', 'Vérifier avant d’envoyer', 'Ouvrir le trajet ne réserve rien. Le parent confirme une place pour lui.'],
  ['confirmed', 'Envoyer une seule demande', 'Après confirmation, le bouton d’envoi disparaît.'],
  ['process-restarted', 'Fermer complètement puis revenir', 'La même demande revient en attente, sans nouvel envoi.'],
  ['other-card', 'Retrouver la demande dans Mes trajets', 'L’autre écran affiche la demande existante, sans doublon.'],
];
export const directBookingPhone = {checkedAt: '2026-10-28', source: directory + 'summary.json', checksums: directory + 'artifact-sha256.json'};
export const directBookingCaptures = Object.fromEntries(steps.map(([phase]) => ['booking-direct-' + phase, directory + 'captures/' + phase + '.png']));
export const directBookingImages = steps.map(([phase, title]) => ({file: 'booking-direct-' + phase, alt: title + ', capture de session du 28 octobre'}));
export const directBookingTour = steps.map(([phase, title, text]) => ({image: 'booking-direct-' + phase, title, text}));
export const directBookingProgress = {
  date: '2026-10-28', title: 'Ouvrir un trajet ne réserve plus automatiquement',
  text: 'Le parent confirme avant d’envoyer. Une seule demande revient après fermeture complète, depuis l’accueil et Mes trajets. Quatre captures de session ajoutées.',
  flow: 'booking', source: directory + 'README.md',
};
