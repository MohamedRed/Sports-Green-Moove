const folder = 'docs/release/evidence/review-context-phone-attempt-2026-10-29/';
export const reviewContextPhoneAttempt = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
export const reviewContextPhoneCaptures = Object.fromEntries(['driver-context', 'driver-rated'].map(name =>
  ['review-trip-phone-' + name, folder + 'captures/' + name + '.jpg']));
export const reviewContextPhoneImages = [
  {file: 'review-trip-phone-driver-context', alt: 'Le conducteur retrouve le nom et la date de son trajet de test, capture de session du 29 octobre'},
  {file: 'review-trip-phone-driver-rated', alt: 'Avis du conducteur envoyé et demande retirée, capture de session du 29 octobre'},
];
export const reviewContextPhoneProgress = {date: '2026-10-29', title: 'Le bon trajet avant l’avis',
  text: 'Nom et date vérifiés sur téléphone, puis avis du conducteur enregistré. Deux captures ajoutées. La reconnexion et le compte parent restent à reprendre.',
  flow: 'ratings', source: folder + 'README.md'};
