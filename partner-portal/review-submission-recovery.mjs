const folder = 'docs/release/evidence/review-submission-recovery-2026-10-29/';
export const reviewSubmissionRecovery = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
const selected = [
  ['failed', 'Le trajet reste visible quand l’envoi échoue'],
  ['recovered', 'La nouvelle tentative confirme l’avis du bon trajet'],
  ['large-text', 'Le message et les cinq étoiles restent lisibles en grands caractères'],
];
export const reviewRecoveryCaptures = Object.fromEntries(selected.map(([id]) => ['review-trip-network-' + id,
  folder + 'captures/review-submission-network-' + id + '.png']));
export const reviewRecoveryImages = selected.map(([id, title]) => ({file: 'review-trip-network-' + id,
  alt: title + ', simulation du 29 octobre'}));
export const reviewRecoveryProgress = {date: '2026-10-29', title: 'Reprendre un avis après une erreur d’envoi',
  text: 'Le trajet reste affiché. Une nouvelle tentative confirme l’avis sans doublon. Vérifié en simulation ; à rejouer sur téléphone.',
  flow: 'ratings', source: folder + 'README.md'};
