const folder = 'docs/release/evidence/chat-draft-replay-phone-2026-10-31/';
export const chatDraftReplayPhone = {source: folder + 'review.json', checkedAt: '2026-10-31', checksums: folder + 'artifact-sha256.json'};
const images = [
  ['before', '01-draft-keyboard', 'Le brouillon avant fermeture, avec le clavier ouvert'],
  ['restored', '08-os-reopened', 'Le même brouillon retrouvé après fermeture complète'],
];
export const chatDraftReplayImages = images.map(([name, , alt]) => ({file: 'chat-draft-replay-' + name,
  alt: alt + ', capture de session du 31 octobre, compte de test'}));
export const chatDraftReplayCaptures = Object.fromEntries(images.map(([name, capture]) =>
  ['chat-draft-replay-' + name, folder + 'captures/' + capture + '-app.png']));
export const chatDraftReplayProgress = {date: '2026-10-31', title: 'Le brouillon revient après fermeture complète',
  text: 'Le nouvel essai passe sur téléphone. Le texte revient sans être envoyé. Deux captures ajoutées.',
  flow: 'messages', source: folder + 'README.md'};
