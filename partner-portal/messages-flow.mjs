import {chatNetworkRecovery, chatNetworkRecheck} from './chat-network-recovery.mjs';
import {latestChatNetworkRecheck} from './chat-network-latest.mjs';
import {chatNetworkRepeat} from './chat-network-repeat.mjs';

export function createMessagesFlow(local, shot) {
  return { id: 'messages', title: 'Messages et notifications', status: 'partial', checkedAt: '2026-10-30',
    summary: 'Le brouillon reste présent après une coupure et le renvoi ne crée pas de doublon, en simulation.',
    verified: 'L’essai local du 30 octobre confirme le renvoi unique et la réponse. Les captures affichées datent du 27 octobre ou des essais précédents.',
    remaining: 'Rejouer le clavier. Répéter les essais de coupure sur téléphones, vérifier les groupes, les brouillons après fermeture et les coupures réelles pendant l’envoi. Pas encore en ligne.',
    networkRecovery: chatNetworkRecovery,
    networkRecoveryRecheck: chatNetworkRecheck,
    networkRecoveryLatest: latestChatNetworkRecheck,
    networkRecoveryRepeat: chatNetworkRepeat,
    local: { ...local(['messages-notifications', 'chat-delivery-safety', 'chat-directory-safety', 'chat-post-commit-response-loss'], [
      'Le parent et le conducteur échangent des messages.',
      'Après une confirmation perdue, deux renvois gardent un seul message et une seule notification.',
      'La lecture est enregistrée sans effacer un message reçu plus tard.',
      'Une personne extérieure ne peut pas ouvrir la conversation ni y répondre.',
      'Les contrôles retrouvent 26 conversations malgré 120 messages dans un seul échange.',
      'Lire les 50 derniers messages laisse les 70 plus anciens comptés comme non lus.',
    ], 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json'), checkedAt: '2026-10-17' },
    ui: { source: 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json', checkedAt: '2026-10-19', groups: ['chat-conversation-ui', 'chat-directory-ui', 'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui'] },
    images: [shot('chat-network-isolated-draft', 'Brouillon conservé pendant la coupure, simulation du 27 octobre'),
      shot('chat-network-isolated-reply', 'Message renvoyé et réponse reçue, simulation du 27 octobre'),
      shot('chat-network-current-draft', 'Brouillon conservé pendant la coupure, essai local du 17 octobre'),
      shot('chat-network-current-reply', 'Message renvoyé et réponse reçue, essai local du 17 octobre'),
      shot('chat-restart-recheck-reply', 'Échange après relancement revérifié en local le 16 octobre'),
      shot('chat-loss-confirmed', 'Un seul message enregistré après les renvois, essai local du 16 octobre'),
      shot('chat-loss-rejected-retry', 'Message prêt à être renvoyé après une erreur, essai local du 16 octobre'),
      shot('chat-restart-reply', 'Échange réussi lors d’un essai précédent du 16 octobre'),
      shot('chat-network-reply', 'Message renvoyé et réponse reçue après la coupure, essai local du 16 octobre'),
      shot('chat-network-draft', 'Brouillon conservé pendant la coupure, essai local du 16 octobre'),
      shot('chat-picker-recovered', 'Réservations acceptées, refusées et annulées visibles, essai local du 16 octobre'),
      shot('chat-reservation', 'Réservation choisie pour le premier message, essai du 15 octobre'),
      shot('chat-empty', 'Conversation avant le premier message, essai du 15 octobre'),
      shot('chat-received', 'Premier message et réponse du conducteur, essai du 15 octobre'),
      shot('chat-history', 'Ancien échange retrouvé dans l’app, essai du 15 octobre'),
      shot('chat-landscape', 'Brouillon conservé en paysage, essai du 15 octobre')], source: 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/README.md' };
}
