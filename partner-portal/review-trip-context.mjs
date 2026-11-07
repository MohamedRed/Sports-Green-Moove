const folder = 'docs/release/evidence/review-trip-context-2026-10-29/';
const baseline = 'docs/release/evidence/native-review-baseline-7e0e22e-2026-10-29/';
export const reviewBaselineGateRecheck = {source: baseline + 'summary.json', checkedAt: '2026-10-29', checksums: baseline + 'artifact-sha256.json'};
export const reviewContextRecheck = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
export const reviewTripCaptures = Object.fromEntries(['choices', 'large-text', 'unavailable'].map(name =>
  ['review-trip-' + name, folder + 'review-trip-context-' + name + '.png']));
export const reviewTripImages = [
  {file: 'review-trip-choices', alt: 'Deux trajets de test du même nom, avec leurs dates, essai local du 29 octobre'},
  {file: 'review-trip-large-text', alt: 'Nom et date du trajet en grand texte, essai local du 29 octobre'},
  {file: 'review-trip-unavailable', landscape: true, alt: 'Détails manquants signalés sans inventer de date, essai local du 29 octobre'},
];
export const reviewTripProgress = {date: '2026-10-29', title: 'Reconnaître le trajet avant de donner son avis',
  text: 'Deux trajets du même nom gardent chacun leur date. Un avis ne retire que la demande choisie. Trois captures locales ajoutées.',
  flow: 'ratings', source: folder + 'README.md'};
export const reviewBaselineGateProgress = {date: '2026-10-29', title: 'Une série complète passe à nouveau',
  text: 'La série complète passe, y compris la reprise du compte. Les nouveaux détails d’avis restent à vérifier dans cette série.',
  flow: 'native-startup', source: baseline + 'README.md'};
