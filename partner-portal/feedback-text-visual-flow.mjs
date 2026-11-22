const folder = 'docs/release/evidence/feedback-text-visual-2026-11-03/';
const cases = ['notices-light-phone', 'notices-dark-wide', 'ride-light-phone', 'input-light-phone', 'input-dark-phone'];
const labels = {notices: 'Alertes et avis', ride: 'Suivi du trajet', input: 'Erreur de saisie'};

export const feedbackVisualCaptures = Object.fromEntries(cases.map(name => ['feedback-text-' + name, folder + 'captures/' + name + '.png']));
export const feedbackVisualImages = cases.map(name => {
  const [screen, theme, format] = name.split('-');
  return {file: 'feedback-text-' + name, landscape: format === 'wide', checkedAt: '2026-11-03',
    alt: `${labels[screen]}, thème ${theme === 'light' ? 'clair' : 'sombre'}, format ${format === 'phone' ? 'étroit' : 'large'}, texte agrandi, essai simulé du 3 novembre`};
});
export const feedbackVisualReview = {source: folder + 'pixel-review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-11-03'};
export const feedbackVisualProgress = {date: '2026-11-03', title: 'Alertes et erreurs plus lisibles',
  text: 'Alertes, avis et saisie revus avec le texte agrandi, en clair et en sombre, en simulation.',
  flow: 'appearance', source: folder + 'README.md'};
