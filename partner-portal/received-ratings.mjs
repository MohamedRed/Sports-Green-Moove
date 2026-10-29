const folder = 'docs/release/evidence/received-ratings-2026-10-29/';
const steps = [
  ['empty-driver', 'Commencer sans avis', 'Aucune note n’est inventée pour un compte sans avis.'],
  ['historical-driver', 'Retrouver sa moyenne', 'La moyenne tient compte des 104 avis reçus.'],
  ['updated-driver', 'Actualiser après un nouvel avis', 'Le profil passe à 105 avis et la moyenne se met à jour.'],
  ['parent', 'Changer de compte', 'Le parent retrouve ses propres 26 avis.'],
];
const captions = [...steps, ['landscape', 'Retrouver la moyenne en paysage']];
export const receivedRatingsRecheck = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
export const receivedRatingCaptures = Object.fromEntries(captions.map(([phase]) => ['received-rating-' + phase, folder + 'captures/' + phase + '.jpg']));
export const receivedRatingImages = captions.map(([phase, title]) => ({file: 'received-rating-' + phase,
  alt: title + ', capture de session du 29 octobre', ...(phase === 'landscape' ? {landscape: true} : {})}));
export const receivedRatingTour = steps.map(([phase, title, text]) => ({image: 'received-rating-' + phase, title, text}));
export const receivedRatingProgress = {date: '2026-10-29', title: 'La moyenne des avis apparaît sur le profil',
  text: 'La moyenne et le nombre d’avis s’actualisent, sans mélanger les comptes. Cinq captures ajoutées.', flow: 'ratings', source: folder + 'README.md'};
export const latestNativeFailureProgress = {date: '2026-10-29', title: 'La série complète s’arrête sur une capture',
  text: 'Un essai s’arrête pendant une capture. Un autre ne peut pas préparer le téléphone. La série complète reste à terminer.',
  flow: 'native-startup', source: folder + 'README.md'};
