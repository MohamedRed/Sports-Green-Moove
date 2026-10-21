const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';
const screens = 'docs/release/evidence/team-chat-components-2026-10-21/';
const partial = 'docs/release/evidence/team-chat-native-peer-2026-10-21/';

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Le parent et le conducteur échangent en local. La suite reste à terminer.',
    verified: 'Le parent reçoit un message et répond dans l’app. Son brouillon revient après réouverture de l’écran. Deux nouvelles captures montrent l’échange.',
    remaining: 'Terminer le retrait de l’accès et le changement de compte, puis vérifier les notifications et les essais sur téléphone.',
    attempt: { source: partial + 'results.json' },
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
      { file: 'team-chat-native-parent', alt: 'Conversation de l’équipe ouverte dans l’app, essai local partiel du 21 octobre' },
      { file: 'team-chat-native-exchange', alt: 'Message du conducteur reçu et réponse du parent, essai local partiel du 21 octobre' },
      { file: 'team-chat-narrow', alt: 'Conversation ouverte sur petit écran avec texte agrandi, essai local simulé du 21 octobre' },
      { file: 'team-chat-unconfirmed', alt: 'Envoi non confirmé, message conservé pour réessayer, essai local simulé du 21 octobre' },
      { file: 'team-chat-confirmed', alt: 'Une seule réponse après le renvoi, essai local simulé du 21 octobre' },
      { file: 'team-chat-denied', alt: 'Conversation et saisie masquées après une erreur de vérification, essai local simulé du 21 octobre' },
    ], source: partial + 'README.md' };
}
