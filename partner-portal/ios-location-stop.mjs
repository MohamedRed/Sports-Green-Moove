const folder = 'docs/release/evidence/ios-location-stop-2026-11-04/';
export const iosLocationStop = {
  source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-04',
};
export const iosLocationStopProgress = {
  date: '2026-11-04', title: 'Le suivi ne repart plus après l’arrêt',
  text: 'Le cas passe en local, même avec un envoi en cours. La déconnexion pendant un trajet reste à terminer sur iPhone.',
  flow: 'tracking', coversFlows: ['signout'], source: folder + 'README.md',
};
