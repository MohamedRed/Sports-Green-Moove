const folder = 'docs/release/evidence/form-feedback-visual-2026-11-03/';
const cases = ['auth-light-phone', 'search-dark-wide', 'chat-error-light-phone',
  'chat-limit-dark-phone', 'chat-sending-light-phone', 'chat-sending-dark-wide'];
const labels = {auth: 'Erreur de connexion', search: 'Erreur de recherche', 'chat-error': 'Envoi non confirmé',
  'chat-limit': 'Message trop long', 'chat-sending': 'Envoi en cours'};

export const formFeedbackCaptures = Object.fromEntries(cases.map(name => ['form-feedback-' + name, folder + 'captures/form-' + name + '.png']));
export const formFeedbackImages = cases.map(name => {
  const state = name.replace(/-(light|dark)-(phone|wide)$/, '');
  return {file: 'form-feedback-' + name, landscape: name.endsWith('-wide'), checkedAt: '2026-11-03',
    alt: `${labels[state]}, thème ${name.includes('-light-') ? 'clair' : 'sombre'}, format ${name.endsWith('-wide') ? 'large' : 'étroit'}, texte agrandi, essai simulé du 3 novembre`};
});
export const formFeedbackVisualReview = {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-11-03'};
export const formFeedbackVisualProgress = {date: '2026-11-03', title: 'Des messages d’erreur plus lisibles',
  text: 'Erreurs de connexion, de recherche et d’envoi revues avec le texte agrandi, en simulation. La coupure réseau reste à vérifier.',
  flow: 'appearance', source: folder + 'README.md'};
