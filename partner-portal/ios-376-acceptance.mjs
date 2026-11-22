const folder = 'docs/release/evidence/ios-automated-acceptance-376addb-2026-11-06/';
const gate = 'docs/release/evidence/ios-fixture-gate-376addb-2026-11-06/';
export const ios376Acceptance = {source: folder + 'summary.json', checksums: gate + 'source-sha256.json',
  gate: {source: gate + 'summary.json', checksums: gate + 'build-input-sha256.json'}, checkedAt: '2026-11-06'};
export const ios376AcceptanceProgress = {
  date: '2026-11-06', title: 'Les 11 essais iPhone passent avec la nouvelle recherche',
  text: 'Recherche, réservation et conversations passent en simulation. Le suivi en déplacement et les notifications restent à tester.',
  flow: 'native-startup', coversFlows: ['search', 'navigation', 'profile-city', 'clubs', 'team-review', 'team-conversation',
    'emergency-contact', 'emergency-profile', 'child-emergency', 'signout', 'ratings'], source: folder + 'README.md',
};
