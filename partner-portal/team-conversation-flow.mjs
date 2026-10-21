const base = 'docs/release/evidence/team-conversation-services-2026-10-21/';
const screens = 'docs/release/evidence/team-chat-components-2026-10-21/';
const partial = 'docs/release/evidence/team-chat-native-peer-2026-10-21/';
const connected = 'docs/release/evidence/team-chat-connected-2026-10-21/';
const accessChanges = 'docs/release/evidence/team-chat-access-2026-10-21/';
const accessAttempt = 'docs/release/evidence/team-access-native-send-2026-10-21/';
const nativeAccess = 'docs/release/evidence/team-access-native-2026-10-21/';

export function createTeamConversationFlow() {
  return { id: 'team-conversation', title: 'Conversation d’équipe', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Le brouillon reste privé. En local, les lectures sont enregistrées séparément pour chaque compte.',
    verified: 'Sur téléphone : brouillon retrouvé, un seul envoi, puis effacement. En local : lectures, accès et messages séparés entre comptes et équipes.',
    remaining: 'Terminer les essais d’affichage des compteurs, puis vérifier les notifications, les messages non lus sur téléphone et les échanges entre téléphones.',
    connected: { source: connected + 'team-conversation-results.json' },
    readServices: { source: 'docs/release/evidence/team-read-services-2026-10-21/services.json' },
    readConnected: { source: 'docs/release/evidence/team-read-connected-2026-10-21/team-conversation-results.json' },
    readAttempt: { source: 'docs/release/evidence/team-read-component-attempt-2026-10-21/results.json' },
    accessChanges: { source: accessChanges + 'results.json' },
    accessAttempt: { source: accessAttempt + 'results.json' },
    nativeAccess: { source: nativeAccess + 'team-access-results.json' },
    draftAttempt: { source: 'docs/release/evidence/team-draft-pre-ui-2026-10-21/results.json' },
    draftRegression: { source: 'docs/release/evidence/team-draft-loss-2026-10-21/results.json' },
    draftRestart: { source: 'docs/release/evidence/team-draft-native-2026-10-21/team-draft-results.json' },
    draftErrorChecks: { source: 'docs/release/evidence/team-draft-error-capture-2026-10-21/results.json' },
    draftErrorRecovery: { source: 'docs/release/evidence/team-draft-error-components-2026-10-21/results.json' },
    phone: { source: 'docs/release/evidence/team-draft-phone-2026-10-21/results.json', checkedAt: '2026-10-21' },
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
      ...[
        ['initial', 'Le parent ne voit que le message postérieur à son admission'],
        ['unsent', 'Brouillon saisi sans envoi'], ['reopened', 'Même brouillon retrouvé après fermeture'],
        ['sent', 'Un seul envoi, puis saisie vidée'], ['cleared', 'Brouillon toujours effacé après une nouvelle fermeture'],
        ['private-parent', 'Second brouillon privé avant changement de compte'],
        ['other-account', 'Le conducteur reçoit le message, sans le brouillon privé du parent'],
        ['returned-parent', 'Retour au parent : son second brouillon est conservé'],
      ].map(([id, alt]) => ({ file: 'team-draft-phone-' + id, alt: alt + ', essai sur téléphone du 21 octobre' })),
      { file: 'team-draft-errors-read', alt: 'Erreur de restauration avec bouton Réessayer, essai local avec panne simulée du 21 octobre' },
      { file: 'team-draft-errors-write', alt: 'Texte conservé pendant une erreur de sauvegarde, essai local avec panne simulée du 21 octobre' },
      ...[
        ['before', 'Brouillon privé saisi avant fermeture'], ['reopened', 'Même brouillon retrouvé après arrêt complet'],
        ['sent', 'Message envoyé une seule fois, champ de saisie vidé'], ['cleared', 'Brouillon toujours effacé après un second arrêt complet'],
        ['other-account', 'Autre compte connecté : aucun brouillon du parent'],
      ].map(([id, alt]) => ({ file: 'team-draft-verified-' + id, alt: alt + ', essai local réussi du 21 octobre' })),
      { file: 'team-draft-loss-before', alt: 'Brouillon privé saisi avant la fermeture, essai local du 21 octobre' },
      { file: 'team-draft-loss-reopened', alt: 'Brouillon perdu après fermeture complète, essai local échoué du 21 octobre' },
      { file: 'team-access-verified-initial', alt: 'Équipe du premier enfant ouverte dans l’essai local réussi du 21 octobre' },
      { file: 'team-access-verified-remaining', alt: 'Accès maintenu via le second enfant, avec son historique, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-revoked', alt: 'Dernier accord retiré : conversation masquée, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-renewed', alt: 'Nouvel accord : seuls les nouveaux messages reviennent, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-other', alt: 'Message reçu et réponse dans la seconde équipe, essai local réussi du 21 octobre' },
      { file: 'team-access-verified-isolated', alt: 'Retour à la première équipe, sans messages de la seconde, essai local réussi du 21 octobre' },
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
    ], source: 'docs/release/evidence/team-draft-phone-2026-10-21/README.md' };
}
