const folder = 'docs/release/evidence/review-receipt-phone-2026-10-30/';
export const reviewReceiptPhone = {source: folder + 'summary.json', checkedAt: '2026-10-30', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['receipt-lost', 'La confirmation perdue laisse le trajet visible'],
  ['parent-confirmed', 'La nouvelle tentative confirme le même avis sans doublon'],
  ['parent-restored', 'Après fermeture complète, seul l’autre trajet reste à noter'],
  ['driver-summary', 'Le conducteur voit une moyenne de 5 sur 5 pour un avis'],
  ['driver-requests', 'Ses deux demandes d’avis restent distinctes'],
];
export const reviewReceiptImages = images.map(([name, label]) => ({file: 'review-receipt-phone-' + name,
  alt: label + ', capture de session du 30 octobre, comptes de test'}));
export const reviewReceiptCaptures = Object.fromEntries(images.map(([name]) =>
  ['review-receipt-phone-' + name, folder + 'captures/' + name + '.jpg']));
export const reviewReceiptProgress = {date: '2026-10-30', title: 'Une confirmation perdue ne crée pas deux avis',
  text: 'La nouvelle tentative retrouve le même avis, conservé après fermeture complète. Le conducteur voit la moyenne et le nombre d’avis. Comptes de test.',
  flow: 'ratings', source: folder + 'README.md'};
