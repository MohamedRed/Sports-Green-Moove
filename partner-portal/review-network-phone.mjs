const folder = 'docs/release/evidence/review-network-phone-2026-10-30/';
export const reviewNetworkPhone = {source: folder + 'summary.json', checkedAt: '2026-10-30', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['offline-failed', 'La coupure conserve les deux demandes et leurs dates'],
  ['parent-rated', 'La nouvelle tentative confirme uniquement le trajet choisi'],
  ['parent-restored', 'Le trajet restant est retrouvé après réouverture'],
  ['driver-summary', 'Le conducteur reçoit une moyenne de 5 sur 5 pour un avis'],
  ['driver-requests', 'Les deux demandes du conducteur restent séparées'],
];
export const reviewNetworkImages = images.map(([name, label]) => ({file: 'review-network-phone-' + name,
  alt: label + ', capture de session du 30 octobre, comptes de test'}));
export const reviewNetworkCaptures = Object.fromEntries(images.map(([name]) =>
  ['review-network-phone-' + name, folder + 'captures/' + name + '.jpg']));
export const reviewNetworkProgress = {date: '2026-10-30', title: 'L’avis reprend après une coupure sur téléphone',
  text: 'Les deux trajets restent visibles. La nouvelle tentative enregistre un seul avis, retrouvé après réouverture. Le conducteur voit 5 sur 5 pour un avis. Comptes de test.',
  flow: 'ratings', source: folder + 'README.md'};
