const folder = 'docs/release/evidence/ios-location-shutdown-2026-11-04/';
export const iosLocationShutdown = {
  source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-04',
};
export const iosLocationShutdownProgress = {
  date: '2026-11-04', title: 'La déconnexion attend la fin du suivi',
  text: 'La reconnexion attend la fin des envois de position, en local. Le parcours complet reste à vérifier sur iPhone.',
  flow: 'signout', coversFlows: ['tracking'], source: folder + 'README.md',
};
