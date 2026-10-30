import {accentControlImages, accentControlReview} from './accent-controls-flow.mjs';
const folder = 'docs/release/evidence/neutral-text-visual-2026-10-30/';
const cases = ['search', 'trips'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));

export const appearanceCaptures = Object.fromEntries(cases.map(name => ['neutral-text-' + name, folder + 'captures/' + name + '.png']));
export const appearanceProgress = {date: '2026-10-30', title: 'Recherche et trajets revus avec le texte agrandi',
  text: 'Huit vues en clair et en sombre sont ajoutées, en simulation. Les boutons colorés et les essais sur téléphone restent à revoir.',
  flow: 'appearance', source: folder + 'README.md'};

export function createAppearanceFlow(ui, shot) {
  return {id: 'appearance', title: 'Affichage et thème sombre', status: 'partial', checkedAt: '2026-10-30',
    latestEvidence: 'phone',
    summary: 'Les libellés des boutons verts et orange sont corrigés et revus sur téléphone.',
    verified: 'Recherche, trajets et récompenses revus en clair et en sombre, avec des données de test. Aucun paiement.',
    remaining: 'Restent les autres textes colorés, les dates des réservations, les marges système et les essais d’accessibilité, dont l’iPhone.',
    accentControlReview,
    ui: {...ui(['landscape-login-ui', 'theme-process-restart-ui']), checkedAt: '2026-10-15'},
    neutralTextReview: {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-30'},
    images: [...accentControlImages, ...cases.map(name => {
      const [screen, theme, format] = name.split('-');
      return {file: 'neutral-text-' + name, landscape: format === 'wide',
        alt: `${screen === 'search' ? 'Recherche' : 'Mes trajets'}, thème ${theme === 'light' ? 'clair' : 'sombre'}, format ${format === 'phone' ? 'étroit' : 'large'}, texte agrandi, essai simulé du 30 octobre avant correction des boutons`,
        checkedAt: '2026-10-30'};
    }), {...shot('local-landscape', 'Formulaire de connexion en paysage, après défilement'), checkedAt: '2026-10-15'},
      {...shot('local-theme', 'Thème sombre conservé après relancement complet'), checkedAt: '2026-10-15'}],
    source: 'docs/release/evidence/accent-controls-phone-2026-10-30/README.md'};
}
