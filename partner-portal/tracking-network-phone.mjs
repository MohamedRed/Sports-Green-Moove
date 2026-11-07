const base = 'docs/release/evidence/tracking-network-phone-2026-10-25/';
export const trackingNetworkPhone = {source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-25'};
const diagnostics = 'docs/release/evidence/tracking-observation-diagnostics-2026-10-25/';
export const trackingNetworkDiagnostics = {source: diagnostics + 'summary.json', checksums: diagnostics + 'artifact-sha256.json', checkedAt: '2026-10-25'};
const transport = 'docs/release/evidence/native-socket-probe-2026-10-25/';
export const trackingNetworkTransportProbe = {source: transport + 'summary.json', checksums: transport + 'artifact-sha256.json', checkedAt: '2026-10-25'};
export const trackingNetworkCaptures = Object.fromEntries(['offline-stale', 'manual-screen-return', 'after-manual-return-observation']
  .map(phase => ['tracking-network-' + phase, base + 'photos/' + phase + '.jpg']));
export const trackingNetworkTour = [
  {image: 'tracking-network-offline-stale', title: 'La position ancienne est signalée', text: 'Pendant la coupure simulée, le trajet reste ouvert et l’app demande de vérifier la position.'},
  {image: 'tracking-network-manual-screen-return', title: 'Revenir dans l’app rafraîchit l’écran', text: 'Les envois reprennent après la coupure, mais il faut quitter puis revenir à l’app pour voir une position récente.'},
  {image: 'tracking-network-after-manual-return-observation', title: 'L’affichage prend à nouveau du retard', text: 'De nouvelles positions arrivent, mais l’écran ne les affiche pas en continu. Ce parcours reste à terminer.'},
];
export function createTrackingNetworkFlow() {
  return {id: 'tracking-network', title: 'Suivi après une coupure réseau', status: 'partial', checkedAt: '2026-10-25', latestEvidence: 'phone',
    summary: 'La connexion de test bloque encore le suivi en direct.',
    verified: 'La course reste ouverte pendant la coupure simulée. L’avertissement apparaît et les envois reprennent au retour du réseau. Comptes et positions de test.',
    remaining: 'Adapter la connexion privée de test, puis rejouer avec le parent et l’enfant. Le suivi pendant un vrai déplacement reste à vérifier.',
    trackingNetworkPhone, trackingNetworkDiagnostics, trackingNetworkTransportProbe,
    images: trackingNetworkTour.map(step => ({file: step.image, alt: step.title + ', essai sur téléphone du 25 octobre'})),
    source: base + 'README.md'};
}
export const trackingNetworkProgress = {date: '2026-10-25', title: 'La coupure révèle un problème d’affichage',
  text: 'Les positions sont à nouveau reçues après la coupure. L’écran ne suit pas encore leurs mises à jour. Trois captures ajoutées.',
  flow: 'tracking-network', source: base + 'README.md'};
export const trackingNetworkDiagnosticsProgress = {date: '2026-10-25', title: 'La connexion du suivi reste à débloquer',
  text: 'Le nouvel essai reçoit les positions, mais la connexion en direct ne s’ouvre pas. Les écrans gardent leur retard. Le parcours reste à terminer.',
  flow: 'tracking-network', source: diagnostics + 'README.md'};
export const trackingNetworkTransportProgress = {date: '2026-10-25', title: 'Le test bute sur sa connexion privée',
  text: 'Un essai séparé confirme que les demandes passent, mais pas la connexion nécessaire au suivi en direct. Le parcours reste à rejouer.',
  flow: 'tracking-network', source: transport + 'README.md'};
