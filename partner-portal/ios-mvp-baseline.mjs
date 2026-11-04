const folder = 'docs/release/evidence/ios-mvp-baseline-2026-11-04/';
export const iosMvpBaseline = {source: folder + 'summary.json', checkedAt: '2026-11-04'};
export const iosMvpProgress = {
  date: '2026-11-04', title: 'Les premiers tests iPhone bloquent',
  text: 'L’essai s’arrête avant l’ouverture de l’app. Les parcours iPhone restent à vérifier.',
  flow: 'navigation', coversFlows: ['messages', 'emergency-contact'], source: folder + 'README.md',
};
export const iosMvpBlocker = {
  id: 'iphone-mvp-flows', title: 'Terminer les parcours iPhone',
  text: 'Les conversations et le contact d’urgence restent à compléter.',
  next: 'Permettre l’ouverture de l’app de test, puis vérifier les parcours et le suivi.',
  source: folder + 'README.md',
};
