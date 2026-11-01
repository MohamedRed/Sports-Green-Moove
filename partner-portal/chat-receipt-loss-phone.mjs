const folder = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
export const chatReceiptPhone = {source: folder + 'review.json', checkedAt: '2026-11-01', checksums: folder + 'artifact-sha256.json'};
const images = [['parent-confirmed', 'Le parent retrouve un seul message malgré la confirmation perdue'],
  ['parent-reopened', 'Le même message revient après réouverture'], ['driver-visible', 'Le conducteur reçoit le message une seule fois']];
export const chatReceiptImages = images.map(([name, alt]) => ({file: 'chat-receipt-phone-' + name,
  alt: alt + ', capture de session du 1er novembre, comptes de test'}));
export const chatReceiptCaptures = Object.fromEntries(images.map(([name]) =>
  ['chat-receipt-phone-' + name, folder + 'captures/' + name + '.png']));
export const chatReceiptTour = [
  {image: 'chat-receipt-phone-parent-confirmed', title: 'Perdre la confirmation', text: 'Le message enregistré apparaît une seule fois, sans nouvel envoi.'},
  {image: 'chat-receipt-phone-parent-reopened', title: 'Rouvrir la conversation', text: 'Le parent retrouve le même message.'},
  {image: 'chat-receipt-phone-driver-visible', title: 'Lire côté conducteur', text: 'Le message est reçu et marqué lu. Deux comptes sur le même téléphone de test.'},
];
export const chatReceiptProgress = {date: '2026-11-01', title: 'Une confirmation perdue ne double pas le message',
  text: 'Le parent le retrouve après réouverture. Le conducteur le reçoit et le lit. Trois captures ajoutées.',
  flow: 'messages', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json'};
