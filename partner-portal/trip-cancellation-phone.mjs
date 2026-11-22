const directory = 'docs/release/evidence/trip-cancellation-phone-2026-10-28/';
const steps = [
  ['01-cancellation-preview', 'Vérifier avant d’annuler', 'Les deux réservations concernées sont affichées. Revenir ne change rien.'],
  ['02-cancellation-recorded', 'Confirmer avec un motif', 'Les réservations sont annulées et les places libérées une seule fois.'],
  ['04-reopened-cancelled-history', 'Fermer puis revenir', 'Le trajet reste annulé après fermeture complète de l’app.'],
  ['05-parent-child-reservations', 'Retrouver la réservation de l’enfant', 'Les deux places de l’enfant apparaissent annulées côté parent.'],
  ['08-second-parent-notice', 'Prévenir chaque parent', 'L’autre parent retrouve aussi son avis avec le motif.'],
];
const captions = [...steps, ['06-parent-notice', 'Avis reçu par le parent de l’enfant'],
  ['07-second-parent-reservation', 'Demande d’une place annulée pour l’autre parent']];
export const tripCancellationPhone = {checkedAt: '2026-10-28', source: directory + 'summary.json', checksums: directory + 'artifact-sha256.json'};
export const tripCancellationCaptures = Object.fromEntries(captions.map(([phase]) => ['cancel-phone-' + phase, directory + 'captures/' + phase + '.jpg']));
export const tripCancellationImages = captions.map(([phase, title]) => ({file: 'cancel-phone-' + phase, alt: title + ', capture de session du 28 octobre'}));
export const tripCancellationTour = steps.map(([phase, title, text]) => ({image: 'cancel-phone-' + phase, title, text}));
export const tripCancellationProgress = {date: '2026-10-28', title: 'Un trajet annulé, les deux parents prévenus',
  text: 'Les réservations se ferment et les places reviennent une seule fois. Le résultat reste après fermeture complète. Sept captures de session ajoutées.',
  flow: 'publication', source: directory + 'README.md'};
