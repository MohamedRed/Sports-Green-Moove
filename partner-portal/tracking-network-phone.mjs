const base = 'docs/release/evidence/tracking-network-phone-2026-10-25/';
export const trackingNetworkPhone = {source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-25'};
export const trackingNetworkCaptures = Object.fromEntries(['offline-stale', 'manual-screen-return', 'after-manual-return-observation']
  .map(phase => ['tracking-network-' + phase, base + 'photos/' + phase + '.jpg']));
export const trackingNetworkTour = [
  {image: 'tracking-network-offline-stale', title: 'La position ancienne est signalée', text: 'Pendant la coupure simulée, le trajet reste ouvert et l’app demande de vérifier la position.'},
  {image: 'tracking-network-manual-screen-return', title: 'Revenir dans l’app rafraîchit l’écran', text: 'Les envois reprennent après la coupure, mais il faut quitter puis revenir à l’app pour voir une position récente.'},
  {image: 'tracking-network-after-manual-return-observation', title: 'L’affichage prend à nouveau du retard', text: 'De nouvelles positions arrivent, mais l’écran ne les affiche pas en continu. Ce parcours reste à corriger.'},
];
export function createTrackingNetworkFlow() {
  return {id: 'tracking-network', title: 'Suivi après une coupure réseau', status: 'partial', checkedAt: '2026-10-25', latestEvidence: 'phone',
    summary: 'Les envois reprennent ; l’affichage reste à corriger.',
    verified: 'La course reste ouverte pendant la coupure simulée. L’avertissement apparaît et les envois reprennent au retour du réseau. Comptes et positions de test.',
    remaining: 'Corriger l’affichage continu : il se rafraîchit au retour à l’app, puis prend à nouveau du retard. Rejouer ensuite avec le parent et l’enfant, puis en trajet réel.',
    trackingNetworkPhone, images: trackingNetworkTour.map(step => ({file: step.image, alt: step.title + ', essai sur téléphone du 25 octobre'})),
    source: base + 'README.md'};
}
export const trackingNetworkProgress = {date: '2026-10-25', title: 'La coupure révèle un problème d’affichage',
  text: 'Les positions sont à nouveau reçues après la coupure. L’écran ne suit pas encore leurs mises à jour. Trois captures ajoutées.',
  flow: 'tracking-network', source: base + 'README.md'};
