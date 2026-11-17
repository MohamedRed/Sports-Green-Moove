const evidenceFolder = 'docs/release/evidence/ios-fixture-gate-97d3cc1-2026-11-16/';

export const iosReservationFixturePass = {
  checkedAt: '2026-11-16',
  source: evidenceFolder + 'summary.json',
  checksums: evidenceFolder + 'build-input-sha256.json',
};

export const iosReservationFixtureProgress = {
  date: iosReservationFixturePass.checkedAt,
  flow: 'navigation',
  coversFlows: ['booking'],
  title: 'Onze tests d’écran réussis en simulation iPhone',
  text: 'Les tests couvrent notamment la confirmation d’annulation d’une réservation parent et les écrans de compte enfant. Le suivi sur téléphone, l’appel d’urgence et les notifications restent à vérifier en conditions réelles.',
  source: iosReservationFixturePass.source,
};
