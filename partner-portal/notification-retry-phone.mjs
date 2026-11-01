const base = 'docs/release/evidence/notification-retry-phone-2026-11-01/';
export const notificationRetryPhone = {source: base + 'run.json', checkedAt: '2026-11-01'};
const stages = [
  ['error', 'Une erreur simulée empêche de charger les alertes'],
  ['recovered', 'Réessayer retrouve les alertes et leur état de lecture'],
  ['next', 'L’alerte suivante arrive sans actualiser'],
];
const files = {error: 'error.png', recovered: 'recovered.png', next: 'next-arrived.png'};
export const notificationRetryCaptures = Object.fromEntries(stages.map(([id]) =>
  ['team-alert-retry-' + id, base + files[id]]));
export const notificationRetryImages = stages.map(([id, alt]) => ({
  file: 'team-alert-retry-' + id, alt: alt + ', essai sur téléphone du 1 novembre', checkedAt: '2026-11-01',
}));
export const notificationRetrySteps = image => stages.map(([id, title]) =>
  image('team-alert-retry-' + id, title, id === 'error'
    ? 'Avec des données de test, une erreur est provoquée. Le premier nouvel essai échoue encore, sans afficher une fausse liste vide.'
    : id === 'recovered' ? 'Une fois l’erreur retirée, Réessayer retrouve l’alerte déjà lue.'
      : 'La liste reste ouverte. Une autre alerte arrive, sans modifier celle déjà lue.'));
export const notificationRetryProgress = {date: '2026-11-01', title: 'Les alertes reprennent après une erreur',
  text: 'Après une erreur simulée, Réessayer retrouve les alertes. La suivante arrive sans actualiser. Trois captures ajoutées.',
  flow: 'team-conversation', source: base + 'README.md'};
