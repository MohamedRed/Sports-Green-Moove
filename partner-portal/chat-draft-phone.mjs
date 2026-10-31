const folder = 'docs/release/evidence/chat-draft-phone-2026-10-31/';
export const chatDraftPhone = {source: folder + 'review.json', checkedAt: '2026-10-31', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['01-draft-keyboard', 'Le brouillon et le bouton d’envoi restent visibles avec le clavier'],
  ['02-conversation-reopened', 'Le brouillon revient à la réouverture de la conversation'],
  ['03-restarted-empty', 'Après arrêt complet de l’app, le brouillon a disparu'],
];
export const chatDraftPhoneImages = images.map(([name, alt]) => ({file: 'chat-draft-' + name,
  alt: alt + ', capture de session du 31 octobre, compte de test'}));
export const chatDraftPhoneCaptures = Object.fromEntries(images.map(([name]) => ['chat-draft-' + name, folder + 'captures/' + name + '.png']));
export const chatDraftPhoneProgress = {date: '2026-10-31', title: 'Un brouillon se perd après fermeture complète',
  text: 'Le défaut est confirmé sur téléphone. La correction passe les tests locaux ; elle reste à rejouer sur téléphone. Trois captures ajoutées.',
  flow: 'messages', source: folder + 'README.md'};
