import {accentControlImages, accentControlReview} from './accent-controls-flow.mjs';
import {feedbackVisualCaptures, feedbackVisualImages, feedbackVisualReview} from './feedback-text-visual-flow.mjs';
import {bookingDateVisualCaptures, bookingDateVisualImages, bookingDateVisualReview} from './booking-date-visual-flow.mjs';
import {formFeedbackCaptures, formFeedbackImages, formFeedbackVisualReview} from './form-feedback-visual-flow.mjs';
const folder = 'docs/release/evidence/neutral-text-visual-2026-10-30/';
const cases = ['search', 'trips'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));

export const appearanceCaptures = {...formFeedbackCaptures, ...bookingDateVisualCaptures, ...feedbackVisualCaptures,
  ...Object.fromEntries(cases.map(name => ['neutral-text-' + name, folder + 'captures/' + name + '.png']))};
export const appearanceProgress = {date: '2026-10-30', title: 'Recherche et trajets revus avec le texte agrandi',
  text: 'Huit vues en clair et en sombre sont ajoutées, en simulation. Les boutons colorés et les essais sur téléphone restent à revoir.',
  flow: 'appearance', source: folder + 'README.md'};

export function createAppearanceFlow(ui, shot) {
  return {id: 'appearance', title: 'Affichage et thème sombre', status: 'partial', checkedAt: '2026-11-03',
    latestEvidence: 'local',
    summary: 'Les dates et messages sont revus en clair et en sombre, avec le texte agrandi.',
    verified: 'Dates, alertes et erreurs de connexion, de recherche et d’envoi revues avec le texte agrandi, sur des vues simulées.',
    remaining: 'Restent les autres textes colorés, les marges système et les essais d’accessibilité, dont l’iPhone.',
    accentControlReview,
    feedbackVisualReview,
    bookingDateVisualReview,
    formFeedbackVisualReview,
    ui: {...ui(['landscape-login-ui', 'theme-process-restart-ui']), checkedAt: '2026-10-15'},
    neutralTextReview: {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-30'},
    images: [...formFeedbackImages, ...bookingDateVisualImages, ...feedbackVisualImages, ...accentControlImages, ...cases.map(name => {
      const [screen, theme, format] = name.split('-');
      return {file: 'neutral-text-' + name, landscape: format === 'wide',
        alt: `${screen === 'search' ? 'Recherche' : 'Mes trajets'}, thème ${theme === 'light' ? 'clair' : 'sombre'}, format ${format === 'phone' ? 'étroit' : 'large'}, texte agrandi, essai simulé du 30 octobre avant correction des boutons`,
        checkedAt: '2026-10-30'};
    }), {...shot('local-landscape', 'Formulaire de connexion en paysage, après défilement'), checkedAt: '2026-10-15'},
      {...shot('local-theme', 'Thème sombre conservé après relancement complet'), checkedAt: '2026-10-15'}],
    source: 'docs/release/evidence/form-feedback-visual-2026-11-03/README.md'};
}
