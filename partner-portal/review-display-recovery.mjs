const folder = 'docs/release/evidence/review-display-recovery-2026-10-29/';
export const reviewDisplayRecheck = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
export const reviewDisplayCaptures = {
  'rating-accessible-count': folder + 'received-ratings-large-text.png',
  'session-current-error': folder + 'recovery/local-session-restoration-error.png',
  'session-current-recovered': folder + 'recovery/local-session-restoration-recovered.png',
};
export const reviewDisplayImage = {file: 'rating-accessible-count', landscape: true,
  alt: 'Moyenne et nombre fictif en grand texte sur une largeur réduite, essai local du 29 octobre'};
export const sessionCurrentImages = [
  {file: 'session-current-error', alt: 'Erreur de connexion visible, essai local du 29 octobre'},
  {file: 'session-current-recovered', landscape: true, alt: 'Accueil retrouvé après Réessayer, essai local du 29 octobre'},
];
export const reviewDisplayProgress = {date: '2026-10-29', title: 'Les avis restent lisibles en grand texte',
  text: 'Moyenne, nombre d’avis et bouton de mise à jour restent séparés sur une largeur réduite. Une capture locale avec un nombre fictif est ajoutée.',
  flow: 'ratings', source: folder + 'README.md'};
export const sessionCurrentProgress = {date: '2026-10-29', title: 'Réessayer ramène au même compte',
  text: 'L’erreur reste visible en tournant l’écran. Après Réessayer, le parent retrouve son accueil et son profil. Deux captures locales sont ajoutées.',
  flow: 'session-restoration', source: folder + 'README.md'};
