const folder = 'docs/release/evidence/ios-mvp-baseline-2026-11-04/';
export const iosMvpBaseline = {source: folder + 'summary.json', checkedAt: '2026-11-04'};
export const iosMvpProgress = {
  date: '2026-11-04', title: 'Les premiers tests iPhone bloquent',
  text: 'L’essai s’arrête avant l’ouverture de l’app. Les parcours iPhone restent à vérifier.',
  flow: 'navigation', coversFlows: ['messages', 'emergency-contact'], source: folder + 'README.md',
};
export const iosMvpBlocker = {
  id: 'iphone-mvp-flows', title: 'Terminer les parcours iPhone',
  text: 'Les étoiles répondent en simulation. Les conversations, le contact d’urgence et la déconnexion restent à compléter.',
  next: 'Terminer ces parcours, puis vérifier le suivi sur téléphone.',
  source: 'docs/release/evidence/ios-fixture-pass-5582299-2026-11-04/README.md',
  fixtureFailure: {source: 'docs/release/evidence/ios-fixture-observation-2026-11-04/README.md'},
  baseline: {source: folder + 'README.md'},
  accountRefresh: {source: 'docs/release/evidence/ios-account-refresh-2026-11-04/README.md'},
};
