const folder = 'docs/release/evidence/ios-membership-2026-11-05/';
export const iosMembership = {source: folder + 'summary.json', checksums: folder + 'source-sha256.json', checkedAt: '2026-11-05'};
export const iosMembershipProgress = {
  date: '2026-11-05', title: 'L’adhésion est reliée sur iPhone',
  text: 'Demande, acceptation et refus passent les contrôles locaux. Il reste à vérifier le parcours dans l’app sur iPhone.',
  flow: 'clubs', source: folder + 'README.md',
};
export const iosMembershipFixtureProgress = {
  date: '2026-11-05', title: 'Deux parcours iPhone restent à vérifier',
  text: 'Neuf essais d’écran sur onze passent. Le contact d’urgence et le retour du chat restent à revérifier.',
  flow: 'native-startup', coversFlows: ['emergency-contact', 'emergency-profile', 'child-emergency'],
  source: folder + 'fixture-results.json',
};
