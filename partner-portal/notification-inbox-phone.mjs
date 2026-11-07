const base = 'docs/release/evidence/notification-inbox-phone-2026-11-01/';
export const notificationInboxPhone = {source: base + 'run.json', checkedAt: '2026-11-01'};
const stages = [
  ['arrived', 'Une nouvelle alerte arrive sans rafraîchir'],
  ['read', 'La lecture de l’alerte est confirmée'],
  ['revoked', 'Le retrait de l’accès masque l’alerte'],
  ['returned', 'Au retour dans l’app, l’alerte retirée reste masquée'],
];
export const notificationInboxPhoneCaptures = Object.fromEntries(stages.map(([id]) =>
  ['team-alert-phone-' + id, base + 'verified/' + id + '.png']));
export const notificationInboxPhoneImages = stages.map(([id, alt]) => ({
  file: 'team-alert-phone-' + id, alt: alt + ', essai sur téléphone du 1 novembre', checkedAt: '2026-11-01',
}));
export const notificationInboxPhoneSteps = image => stages.map(([id, title]) =>
  image('team-alert-phone-' + id, title, id === 'arrived'
    ? 'Essai avec des comptes de test. L’alerte apparaît dans la liste déjà ouverte.'
    : id === 'read' ? 'La mention « Lue » apparaît après confirmation.'
      : id === 'revoked' ? 'L’alerte de l’équipe disparaît ; les autres alertes restent présentes.'
        : 'Après un passage hors de l’app, le retrait est toujours respecté.'));
export const notificationInboxPhoneProgress = {date: '2026-11-01', title: 'Les alertes arrivent dans l’app',
  text: 'Arrivée sans rafraîchir, lecture et retrait d’accès vérifiés sur téléphone. Quatre captures ajoutées. L’envoi app fermée reste à faire.',
  flow: 'team-conversation', source: base + 'README.md'};
