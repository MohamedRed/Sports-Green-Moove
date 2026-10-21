const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';
const screens = 'docs/release/evidence/team-chat-components-2026-10-21/';
const partial = 'docs/release/evidence/team-chat-native-peer-2026-10-21/';
const connected = 'docs/release/evidence/team-chat-connected-2026-10-21/';
const accessChanges = 'docs/release/evidence/team-chat-access-2026-10-21/';
const accessAttempt = 'docs/release/evidence/team-access-native-send-2026-10-21/';

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Les accès des deux enfants avancent dans l’app. La seconde équipe reste à terminer.',
    verified: 'Les accès via deux enfants passent côté données et en partie dans l’app. Quatre captures montrent les retraits et le retour sans anciens messages.',
    remaining: 'Terminer la réponse dans la seconde équipe et le retour à la première. Vérifier notifications, messages non lus, fermeture complète et échanges entre téléphones.',
    connected: { source: connected + 'team-conversation-results.json' },
    accessChanges: { source: accessChanges + 'results.json' },
    accessAttempt: { source: accessAttempt + 'results.json' },
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
      { file: 'team-access-attempt-initial', alt: 'Accès initial par le premier enfant, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-remaining', alt: 'Accès conservé via le second enfant, avec son propre historique, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-revoked', alt: 'Les deux accords retirés masquent la conversation, essai local partiel du 21 octobre' },
      { file: 'team-access-attempt-renewed', alt: 'Nouvel accord sans retour des anciens messages, essai local partiel du 21 octobre' },
      { file: 'team-chat-connected-parent', alt: 'Le parent ouvre son équipe sans les messages antérieurs à son arrivée, essai local du 21 octobre' },
      { file: 'team-chat-connected-exchange', alt: 'Message du conducteur et réponse du parent, nouvel essai local du 21 octobre' },
      { file: 'team-chat-connected-revoked', alt: 'Conversation masquée après retrait de l’accord du parent, essai local du 21 octobre' },
      { file: 'team-chat-connected-driver', alt: 'Le conducteur retrouve son échange et répond après changement de compte, essai local du 21 octobre' },
      { file: 'team-chat-native-parent', alt: 'Conversation de l’équipe ouverte dans l’app, essai local partiel du 21 octobre' },
      { file: 'team-chat-native-exchange', alt: 'Message du conducteur reçu et réponse du parent, essai local partiel du 21 octobre' },
      { file: 'team-chat-narrow', alt: 'Conversation ouverte sur petit écran avec texte agrandi, essai local simulé du 21 octobre' },
      { file: 'team-chat-unconfirmed', alt: 'Envoi non confirmé, message conservé pour réessayer, essai local simulé du 21 octobre' },
      { file: 'team-chat-confirmed', alt: 'Une seule réponse après le renvoi, essai local simulé du 21 octobre' },
      { file: 'team-chat-denied', alt: 'Conversation et saisie masquées après une erreur de vérification, essai local simulé du 21 octobre' },
    ], source: accessAttempt + 'README.md' };
}
