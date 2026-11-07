const folder = 'docs/release/evidence/chat-network-phone-2026-10-31/';
export const chatNetworkPhone = {source: folder + 'review.json', checkedAt: '2026-10-31', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['offline-unconfirmed', 'Le texte reste présent pendant la coupure contrôlée'],
  ['online-before-retry', 'La connexion revient sans envoyer le message toute seule'],
  ['parent-sent', 'Le renvoi confirme un seul message'],
  ['reply-read', 'La réponse de test du conducteur est reçue'],
];
export const chatNetworkPhoneImages = images.map(([name, label]) => ({file: 'chat-phone-' + name,
  alt: label + ', capture de session du 31 octobre, comptes de test'}));
export const chatNetworkPhoneCaptures = Object.fromEntries(images.map(([name]) => ['chat-phone-' + name, folder + 'captures/' + name + '.jpg']));
export const chatNetworkPhoneTour = [
  {image: 'chat-phone-offline-unconfirmed', title: 'Garder le texte', text: 'Sur téléphone, une coupure contrôlée laisse le message non confirmé.'},
  {image: 'chat-phone-online-before-retry', title: 'Retrouver la connexion', text: 'Le message attend encore une action du parent.'},
  {image: 'chat-phone-parent-sent', title: 'Réessayer', text: 'Un seul message et une seule notification sont enregistrés.'},
  {image: 'chat-phone-reply-read', title: 'Recevoir la réponse', text: 'Une réponse simulée du conducteur arrive sur le téléphone du parent.'},
];
export const chatNetworkPhoneProgress = {date: '2026-10-31', title: 'Le message repart sans doublon sur téléphone',
  text: 'Une coupure contrôlée garde le texte. Réessayer envoie un seul message, puis la réponse de test arrive. Quatre captures ajoutées.',
  flow: 'messages', source: folder + 'README.md'};
