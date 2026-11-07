import {chatNetworkRecovery, chatNetworkRecheck} from './chat-network-recovery.mjs';
import {latestChatNetworkRecheck} from './chat-network-latest.mjs';
import {chatNetworkRepeat} from './chat-network-repeat.mjs';
import {chatNetworkPhone, chatNetworkPhoneImages} from './chat-network-phone.mjs';
import {chatDraftPhone, chatDraftPhoneImages} from './chat-draft-phone.mjs';
import {chatDraftReplayPhone, chatDraftReplayImages} from './chat-draft-replay-phone.mjs';
import {chatOwnerDraftRecheck} from './session-recovery-recheck.mjs';
import {chatPendingRestartPhone,chatPendingRestartImages} from './chat-pending-restart-phone.mjs';
import {chatAccountSwitchPhone,chatAccountSwitchImages} from './chat-account-switch-phone.mjs';
import {chatReceiptPhone, chatReceiptImages} from './chat-receipt-loss-phone.mjs';
import {networkPreparationRecheck} from './network-preparation-recheck.mjs';
import {chatRgbNormalization} from './chat-proof-rgb-normalization.mjs';

export function createMessagesFlow(local, shot) {
  return { id: 'messages', title: 'Messages et notifications', status: 'partial', checkedAt: '2026-11-01', latestEvidence: 'phone',
    summary: 'Une confirmation perdue ne double pas le message.',
    verified: 'Le parent retrouve un seul message après réouverture. Le conducteur le reçoit et le lit. L’envoi en attente reste aussi privé entre comptes.',
    remaining: 'À tester entre deux téléphones, avec de vraies coupures, puis pour les groupes et le clavier sur iPhone. Pas encore en ligne.',
    postCommitReceiptLossPhone: chatReceiptPhone,
    networkPreparationRecheck,
    captureNormalization: chatRgbNormalization,
    pendingSendAccountSwitchPhone: chatAccountSwitchPhone,
    pendingSendRestartPhone: chatPendingRestartPhone,
    unsentDraftPhone: chatDraftPhone,
    unsentDraftReplayPhone: chatDraftReplayPhone,
    ownerDraftRecheck: chatOwnerDraftRecheck,
    networkRecovery: chatNetworkRecovery,
    networkRecoveryRecheck: chatNetworkRecheck,
    networkRecoveryLatest: latestChatNetworkRecheck,
    networkRecoveryRepeat: chatNetworkRepeat,
    networkRecoveryPhone: chatNetworkPhone,
    local: { ...local(['messages-notifications', 'chat-delivery-safety', 'chat-directory-safety', 'chat-post-commit-response-loss'], [
      'Le parent et le conducteur échangent des messages.',
      'Après une confirmation perdue, deux renvois gardent un seul message et une seule notification.',
      'La lecture est enregistrée sans effacer un message reçu plus tard.',
      'Une personne extérieure ne peut pas ouvrir la conversation ni y répondre.',
      'Les contrôles retrouvent 26 conversations malgré 120 messages dans un seul échange.',
      'Lire les 50 derniers messages laisse les 70 plus anciens comptés comme non lus.',
    ], 'docs/release/evidence/local-booking-recovery-2026-10-17/services.json'), checkedAt: '2026-10-17' },
    ui: { source: 'docs/release/evidence/native-matrix-67ab59c-2026-10-19/replay/results.json', checkedAt: '2026-10-19', groups: ['chat-conversation-ui', 'chat-directory-ui', 'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui'] },
    images: [...chatReceiptImages, ...chatAccountSwitchImages, ...chatPendingRestartImages, ...chatDraftReplayImages, ...chatNetworkPhoneImages, ...chatDraftPhoneImages, shot('chat-network-isolated-draft', 'Brouillon conservé pendant la coupure, simulation du 27 octobre'),
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
