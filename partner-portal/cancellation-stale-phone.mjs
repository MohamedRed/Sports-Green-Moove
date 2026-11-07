const directory = 'docs/release/evidence/cancellation-stale-phone-2026-10-30/';
const steps = [
  ['preview-before-peer', 'Préparer l’annulation', 'Le conducteur vérifie les deux réservations et indique son motif.'],
  ['stale-confirmation', 'Refuser une ancienne confirmation', 'Une réservation est acceptée depuis une autre session. L’ancienne confirmation ne peut plus annuler le trajet.'],
  ['preview-refreshed', 'Actualiser avant de confirmer', 'L’app demande de vérifier les nouveaux totaux. Le motif est conservé.'],
  ['cancellation-confirmed', 'Confirmer les nouveaux détails', 'Les deux réservations sont annulées, sans doublon. Chaque parent reçoit un avis dans l’app.'],
  ['driver-history', 'Retrouver les places disponibles', 'Le trajet est annulé. Les trois places réservées sont rendues : quatre places sont disponibles.'],
];

export const staleCancellationPhone = {checkedAt: '2026-10-30', source: directory + 'summary.json', checksums: directory + 'artifact-sha256.json'};
export const staleCancellationCaptures = Object.fromEntries(steps.map(([phase]) => ['cancel-stale-phone-' + phase, directory + 'captures/' + phase + '-phone.png']));
export const staleCancellationImages = steps.map(([phase, title]) => ({file: 'cancel-stale-phone-' + phase, alt: title + ', capture de session du 30 octobre'}));
export const staleCancellationTour = steps.map(([phase, title, text]) => ({image: 'cancel-stale-phone-' + phase, title, text}));
export const staleCancellationProgress = {date: '2026-10-30', title: 'L’annulation tient compte des réservations modifiées',
  text: 'L’ancienne confirmation est refusée sur téléphone. Après actualisation, le trajet s’annule sans doublon. Cinq captures ajoutées.',
  flow: 'publication', source: directory + 'README.md', checksums: directory + 'artifact-sha256.json'};
export const cancellationBaselineProgress = {date: '2026-10-30', title: 'La série de contrôles passe à nouveau',
  text: 'Le nouvel essai complet passe en simulation. Les anciennes interruptions restent à expliquer.',
  flow: 'native-startup', source: directory + 'README.md', checksums: directory + 'artifact-sha256.json'};
