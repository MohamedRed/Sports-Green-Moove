const folder = 'docs/release/evidence/ios-mvp-baseline-2026-11-04/';
export const iosMvpBaseline = {source: folder + 'summary.json', checkedAt: '2026-11-04'};
export const iosMvpProgress = {
  date: '2026-11-04', title: 'Les tests iPhone reprennent',
  text: 'Les conversations et le contact d’urgence restent à compléter sur iPhone.',
  flow: 'navigation', coversFlows: ['messages', 'emergency-contact'], source: folder + 'README.md',
};
export const iosMvpBlocker = {
  id: 'iphone-mvp-flows', title: 'Terminer les parcours iPhone',
  text: 'Les conversations et le contact d’urgence restent à compléter.',
  next: 'Compiler l’app, puis vérifier les parcours et le suivi sur iPhone.',
  source: folder + 'README.md',
};
