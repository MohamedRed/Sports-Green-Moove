const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';
const screens = 'docs/release/evidence/team-chat-components-2026-10-21/';

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Les écrans passent les essais simulés. Quatre captures sont ajoutées.',
    verified: 'La conversation s’ouvre sur petit écran. Le renvoi n’ajoute pas de doublon. Une erreur d’accès masque les messages et la saisie, dans ces essais simulés.',
    remaining: 'Vérifier l’échange entre deux comptes dans l’app, les notifications et les essais sur téléphone.',
    ui: { source: screens + 'results.json', groups: ['team-chat-entry-and-narrow-layout',
      'team-chat-authorization-failure-hides-thread', 'team-chat-unconfirmed-send-reuses-one-intent'] },
    local: { source: base + 'services.json', checkedAt: '2026-10-21', groups: [
      'verified-parent-joins-approved-child-team-without-earlier-history',
      'guardian-revocation-denies-read-pagination-send-and-replay',
      'second-independently-verified-parent-is-included-with-its-own-history-boundary',
      'child-token-cannot-be-bypassed-with-mixed-adult-roles',
      'adult-team-reapproval-does-not-recover-prior-history',
    ], checks: ['Un nouveau membre ne voit pas les anciens messages.',
      'Chaque parent doit avoir son propre accord du club.',
      'Les comptes enfants restent exclus.', 'Le retrait bloque aussi l’envoi et les anciennes pages.',
      'Une réinscription ne rouvre pas l’ancien historique.'] },
    images: [
      { file: 'team-chat-narrow', alt: 'Conversation ouverte sur petit écran avec texte agrandi, essai local simulé du 21 octobre' },
      { file: 'team-chat-unconfirmed', alt: 'Envoi non confirmé, message conservé pour réessayer, essai local simulé du 21 octobre' },
      { file: 'team-chat-confirmed', alt: 'Une seule réponse après le renvoi, essai local simulé du 21 octobre' },
      { file: 'team-chat-denied', alt: 'Conversation et saisie masquées après une erreur de vérification, essai local simulé du 21 octobre' },
    ], source: screens + 'README.md' };
}
