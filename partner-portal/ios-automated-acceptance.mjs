const folder = 'docs/release/evidence/ios-automated-acceptance-f61e0f7-2026-11-05/';
const gate = 'docs/release/evidence/ios-fixture-gate-f61e0f7-2026-11-05/';
export const iosAutomatedAcceptance = {source: folder + 'summary.json', checksums: gate + 'source-sha256.json',
  gate: {source: gate + 'summary.json', checksums: gate + 'build-input-sha256.json'}, checkedAt: '2026-11-05'};
export const iosAutomatedAcceptanceProgress = {
  date: '2026-11-05', title: 'Les 11 essais iPhone passent sur la version actuelle',
  text: 'Réservation et conversations passent en simulation. Le suivi réel et les notifications restent à terminer.',
  flow: 'native-startup', coversFlows: ['navigation', 'profile-city', 'clubs', 'team-review', 'team-conversation',
    'emergency-contact', 'emergency-profile', 'child-emergency', 'signout', 'ratings'], source: folder + 'README.md',
};
