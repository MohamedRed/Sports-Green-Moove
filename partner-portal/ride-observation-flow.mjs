const source = 'docs/release/evidence/ride-observation-native-2026-10-19/';
export function createRideObservationFlow() {
  return { id: 'ride-observation', title: 'Suivi côté parent', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Les statuts s’actualisent côté parent. Les nouveaux contrôles des positions passent en local.',
    verified: 'Position ancienne signalée, nouvelle position reçue, prise en charge, dépose et fin visibles. Le trajet terminé rejoint l’historique.',
    remaining: 'Tester le véhicule sur la carte, puis les vraies positions du véhicule et des enfants, l’arrivée estimée, le verrouillage et les coupures sur téléphone. Pas encore en ligne.',
    local: { source: 'docs/release/evidence/vehicle-map-services-2026-10-19/services.json', groups: ['vehicle-map-points'], checks: [
      'Le parent reçoit la position du véhicule de son trajet.',
      'Les points impossibles, futurs ou retardés ne déplacent pas la position conservée.',
      'Un compte extérieur au trajet ne peut pas consulter cette position.',
      'La fin du trajet retire sa position active.',
    ] },
    ui: { source: source + 'ride-observation-results.json', groups: ['ride-observation-ui'] },
    images: [
      ['fresh', 'Position de test reçue côté parent'], ['fresh-landscape', 'Même trajet après rotation de l’écran'],
      ['stale', 'Alerte après plus de 90 secondes sans nouvelle position'], ['recovered', 'Alerte retirée à réception d’une nouvelle position de test'],
      ['pickup', 'Prise en charge visible sans quitter le trajet'], ['resumed', 'Dépose visible au retour dans l’app'],
      ['ended', 'Fin du trajet reçue côté parent'], ['history', 'Trajet terminé retrouvé dans l’historique'],
    ].map(([id, alt]) => ({ file: 'ride-observation-' + id, alt: alt + ', essai local du 19 octobre' })),
    source: 'docs/release/evidence/vehicle-map-services-2026-10-19/README.md' };
}
