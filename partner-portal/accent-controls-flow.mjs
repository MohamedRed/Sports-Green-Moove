const folder = 'docs/release/evidence/accent-controls-phone-2026-10-30/';
const labels = { 'search-light': 'Recherche en clair', 'search-dark': 'Recherche en sombre',
  'trips-dark': 'Sélections dans Mes trajets', 'rewards-dark': 'Bouton orange en sombre', 'rewards-light': 'Bouton orange en clair' };

export const accentControlImages = Object.entries(labels).map(([phase, label]) => ({file: 'accent-control-' + phase,
  alt: label + ', capture de session du 30 octobre, données de test', checkedAt: '2026-10-30', landscape: false}));
export const accentControlCaptures = Object.fromEntries(Object.keys(labels).map(phase => ['accent-control-' + phase, folder + 'captures/' + phase + '.png']));
export const accentControlReview = {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-30'};
export const accentControlProgress = {date: '2026-10-30', title: 'Les boutons sont revus sur téléphone',
  text: 'Recherche, trajets et récompenses en clair et en sombre. Cinq captures ajoutées, sans paiement.',
  flow: 'appearance', source: folder + 'README.md'};
