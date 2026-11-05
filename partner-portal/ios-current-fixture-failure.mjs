const folder = 'docs/release/evidence/ios-fixture-failure-d51-2026-11-05/';
export const iosCurrentFixtureFailure = {source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-05'};
export const iosCurrentFixtureFailureProgress = {
  date: '2026-11-05', title: 'Huit essais iPhone passent, trois restent bloqués',
  text: 'Les contacts d’urgence et la déconnexion passent en simulation. La ville du profil, le texte du chat et l’accord du club restent à corriger.',
  flow: 'native-startup', coversFlows: ['profile-city', 'team-conversation', 'team-review', 'emergency-contact', 'emergency-profile', 'child-emergency'],
  source: folder + 'README.md',
};
