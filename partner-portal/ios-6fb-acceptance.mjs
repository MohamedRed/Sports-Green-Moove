const folder = 'docs/release/evidence/ios-fixture-gate-6fb6487-2026-11-06/';
export const ios6fbAcceptance = {source: folder + 'summary.json', checksums: folder + 'source-sha256.json',
  sha256: '2a037255a5c65ce7595bb2996c638c14fb3ad7f8f72e1be606f88c642c8c283e', checkedAt: '2026-11-06'};
export const ios6fbAcceptanceProgress = {
  date: '2026-11-06', title: 'Les 11 parcours iPhone passent sur la version actuelle',
  text: 'Recherche, réservation, messages et validation d’un membre passent en simulation. Les essais en déplacement et les notifications restent à vérifier.',
  flow: 'clubs', coversFlows: ['native-startup', 'login', 'search', 'navigation', 'profile-city', 'team-review', 'team-conversation',
    'emergency-contact', 'emergency-profile', 'child-emergency', 'signout', 'ratings'], source: folder + 'README.md',
};
