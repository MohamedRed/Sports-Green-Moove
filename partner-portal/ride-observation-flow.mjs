const source = 'docs/release/evidence/ride-observation-native-2026-10-19/';
export function createRideObservationFlow() {
  return { id: 'ride-observation', title: 'Suivi côté parent', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le parent voit les statuts changer sans quitter le trajet, dans l’essai local.',
    verified: 'Position ancienne signalée, nouvelle position reçue, prise en charge, dépose et fin visibles. Le trajet terminé rejoint l’historique.',
    remaining: 'Terminer la carte et tester les vraies positions, le verrouillage et les coupures sur téléphone.',
    ui: { source: source + 'ride-observation-results.json', groups: ['ride-observation-ui'] },
    images: [
      ['fresh', 'Position de test reçue côté parent'], ['fresh-landscape', 'Même trajet après rotation de l’écran'],
      ['stale', 'Alerte après plus de 90 secondes sans nouvelle position'], ['recovered', 'Alerte retirée à réception d’une nouvelle position de test'],
      ['pickup', 'Prise en charge visible sans quitter le trajet'], ['resumed', 'Dépose visible au retour dans l’app'],
      ['ended', 'Fin du trajet reçue côté parent'], ['history', 'Trajet terminé retrouvé dans l’historique'],
    ].map(([id, alt]) => ({ file: 'ride-observation-' + id, alt: alt + ', essai local du 19 octobre' })),
    source: source + 'README.md' };
}
