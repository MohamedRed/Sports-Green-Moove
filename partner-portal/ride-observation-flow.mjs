const source = 'docs/release/evidence/ride-observation-native-2026-10-19/';
export function createRideObservationFlow() {
  return { id: 'ride-observation', title: 'Suivi côté parent', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le véhicule se déplace sur la carte avec des positions de test. Les statuts s’actualisent.',
    verified: 'Le véhicule change de position sans déplacer la carte. Les statuts et l’historique passent aussi en local.',
    remaining: 'Vérifier les vraies positions du véhicule et des enfants, l’arrivée estimée, l’arrière-plan, le verrouillage et les coupures sur téléphone. Pas encore en ligne.',
    local: { source: 'docs/release/evidence/vehicle-map-services-2026-10-19/services.json', groups: ['vehicle-map-points'], checks: [
      'Le parent reçoit la position du véhicule de son trajet.',
      'Les points impossibles, futurs ou retardés ne déplacent pas la position conservée.',
      'Un compte extérieur au trajet ne peut pas consulter cette position.',
      'La fin du trajet retire sa position active.',
    ] },
    ui: { source: source + 'ride-observation-results.json', groups: ['ride-observation-ui'] },
    mapUi: { source: 'docs/release/evidence/vehicle-map-display-pass-2026-10-19/replay/vehicle-map-results.json',
      images: ['vehicle-map-first', 'vehicle-map-moved'] },
    images: [
      { file: 'vehicle-map-first', alt: 'Première position de test du véhicule sur la carte, essai local du 19 octobre' },
      { file: 'vehicle-map-moved', alt: 'Nouvelle position de test reçue ; le véhicule bouge sans déplacer la carte, essai local du 19 octobre' },
      ...[
        ['fresh', 'Position de test reçue côté parent'], ['fresh-landscape', 'Même trajet après rotation de l’écran'],
        ['stale', 'Alerte après plus de 90 secondes sans nouvelle position'], ['recovered', 'Alerte retirée à réception d’une nouvelle position de test'],
        ['pickup', 'Prise en charge visible sans quitter le trajet'], ['resumed', 'Dépose visible au retour dans l’app'],
        ['ended', 'Fin du trajet reçue côté parent'], ['history', 'Trajet terminé retrouvé dans l’historique'],
      ].map(([id, alt]) => ({ file: 'ride-observation-' + id, alt: alt + ', essai local du 19 octobre' })),
      { file: 'vehicle-map-unverified', alt: 'Carte visible ; essai arrêté avant de vérifier le déplacement, le 19 octobre' },
    ],
    source: 'docs/release/evidence/vehicle-map-display-pass-2026-10-19/README.md' };
}
