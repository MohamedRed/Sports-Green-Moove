const folder = 'docs/release/evidence/ios-mvp-baseline-2026-11-04/';
export const iosMvpBaseline = {source: folder + 'summary.json', checkedAt: '2026-11-04'};
export const iosMvpProgress = {
  date: '2026-11-04', title: 'Les premiers tests iPhone bloquent',
  text: 'L’essai s’arrête avant l’ouverture de l’app. Les parcours iPhone restent à vérifier.',
  flow: 'navigation', coversFlows: ['messages', 'emergency-contact'], source: folder + 'README.md',
};
export const iosMvpBlocker = {
  id: 'iphone-mvp-flows', title: 'Terminer les parcours iPhone',
  text: 'L’app s’ouvre en simulation. Le test des étoiles d’avis échoue ; les conversations et le contact d’urgence restent à compléter.',
  next: 'Corriger les avis, puis vérifier les autres parcours et le suivi sur téléphone.',
  source: 'docs/release/evidence/ios-fixture-observation-2026-11-04/README.md',
  baseline: {source: folder + 'README.md'},
};
