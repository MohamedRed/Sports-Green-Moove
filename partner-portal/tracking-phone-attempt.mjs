const base = 'docs/release/evidence/tracking-phone-clock-2026-10-25/';
export const trackingPhoneAttempt = {source: base + 'session-results.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-25'};
export const trackingAttemptCaptures = Object.fromEntries(['startup-gps-unconfirmed', 'foreground-first', 'foreground-move-not-received']
  .map(phase => ['tracking-attempt-' + phase, base + 'captures/' + phase + '.jpg']));
export const trackingAttemptTour = [
  {image: 'tracking-attempt-startup-gps-unconfirmed', title: 'Le démarrage bloque', text: 'La position du téléphone n’est pas confirmée, avec les données de test.'},
  {image: 'tracking-attempt-foreground-first', title: 'Un premier point est reçu', text: 'Après reprise, le trajet s’ouvre. Le message d’erreur précédent reste affiché.'},
  {image: 'tracking-attempt-foreground-move-not-received', title: 'La position ne se renouvelle pas', text: 'Le déplacement simulé n’arrive pas. L’app affiche une position ancienne.'},
];
export const trackingAttemptImages = trackingAttemptTour.map(step => ({file: step.image, alt: step.title + ', essai incomplet sur téléphone du 25 octobre'}));
export const trackingAttemptProgress = {date: '2026-10-25', title: 'Un écart d’horloge bloque le suivi',
  text: 'Un premier point est reçu, puis les suivants sont refusés. L’alerte de position ancienne apparaît. Trois captures ajoutées ; le suivi reste à corriger.',
  flow: 'tracking', source: base + 'README.md'};
