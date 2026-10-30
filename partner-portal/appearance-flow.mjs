const folder = 'docs/release/evidence/neutral-text-visual-2026-10-30/';
const cases = ['search', 'trips'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));

export const appearanceCaptures = Object.fromEntries(cases.map(name => ['neutral-text-' + name, folder + 'captures/' + name + '.png']));
export const appearanceProgress = {date: '2026-10-30', title: 'Recherche et trajets revus avec le texte agrandi',
  text: 'Huit vues en clair et en sombre sont ajoutées, en simulation. Les boutons colorés et les essais sur téléphone restent à revoir.',
  flow: 'appearance', source: folder + 'README.md'};

export function createAppearanceFlow(ui, shot) {
  return {id: 'appearance', title: 'Affichage et thème sombre', status: 'partial', checkedAt: '2026-10-30',
    summary: 'Les textes secondaires de Recherche et Mes trajets sont revus en clair et en sombre, en simulation.',
    verified: 'Huit vues avec le texte agrandi, en format étroit et large. Le thème reste conservé dans l’ancien essai de relancement.',
    remaining: 'Revoir les boutons colorés, les dates des réservations, les marges système et l’accessibilité sur téléphone.',
    ui: {...ui(['landscape-login-ui', 'theme-process-restart-ui']), checkedAt: '2026-10-15'},
    neutralTextReview: {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-30'},
    images: [...cases.map(name => {
      const [screen, theme, format] = name.split('-');
      return {file: 'neutral-text-' + name, landscape: format === 'wide',
        alt: `${screen === 'search' ? 'Recherche' : 'Mes trajets'}, thème ${theme === 'light' ? 'clair' : 'sombre'}, format ${format === 'phone' ? 'étroit' : 'large'}, texte agrandi, en simulation le 30 octobre`,
        checkedAt: '2026-10-30'};
    }), {...shot('local-landscape', 'Formulaire de connexion en paysage, après défilement'), checkedAt: '2026-10-15'},
      {...shot('local-theme', 'Thème sombre conservé après relancement complet'), checkedAt: '2026-10-15'}],
    source: folder + 'README.md'};
}
