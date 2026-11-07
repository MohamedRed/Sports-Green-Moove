const folder = 'docs/release/evidence/chat-network-isolated-2026-10-27/';
export const chatNetworkRecovery = { source: folder + 'chat-network-recovery-results.json', checkedAt: '2026-10-27' };
const recheck = 'docs/release/evidence/chat-network-recheck-7417e22-2026-10-28/';
export const chatNetworkRecheck = {source: recheck + 'chat-network-recovery-results.json', checkedAt: '2026-10-28'};
export const chatNetworkRecheckProgress = {date: '2026-10-28', title: 'L’envoi reprend après la coupure',
  text: 'Le nouvel essai isolé reprend l’envoi sans doubler le message. À confirmer sur téléphone réel.',
  flow: 'messages', source: recheck + 'README.md'};
export const chatNetworkRecoveryCaptures = {
  'chat-network-isolated-draft': folder + 'captures/local-chat-network-unconfirmed.png',
  'chat-network-isolated-reply': folder + 'captures/local-chat-network-received.png',
};
export const chatNetworkRecoveryProgress = {
  date: '2026-10-27', title: 'Le message repart après la coupure',
  text: 'Le brouillon reste présent, le renvoi ne crée pas de doublon et la réponse arrive. Deux captures ajoutées. Essai en simulation ; à refaire sur téléphone.',
  flow: 'messages', source: folder + 'README.md',
};
export const chatNetworkRecoveryTour = [
  { image: 'chat-network-isolated-draft', title: 'Garder le brouillon',
    text: 'Pendant la coupure, le message reste prêt à être renvoyé. Essai en simulation du 27 octobre.' },
  { image: 'chat-network-isolated-reply', title: 'Reprendre l’échange',
    text: 'Après rétablissement de la connexion et renvoi, le message et la réponse apparaissent sans doublon.' },
];
