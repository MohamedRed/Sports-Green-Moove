const folder = 'docs/release/evidence/ios-fixture-gate-959e70b-2026-11-06/';
export const ios959Recheck = {source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-06'};
export const ios959RecheckProgress = {
  date: '2026-11-06', title: 'Les 11 essais iPhone repassent sur la version précédente',
  text: 'Les 11 essais passent en simulation, sans la nouvelle correction de recherche. Celle-ci reste à vérifier sur iPhone.',
  flow: 'native-startup', coversFlows: ['navigation', 'profile-city', 'clubs', 'team-review', 'team-conversation',
    'emergency-contact', 'emergency-profile', 'child-emergency', 'signout', 'ratings'], source: folder + 'README.md',
};
