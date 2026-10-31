const folder = 'docs/release/evidence/review-pagination-2026-10-29/';
const images = [
  ['driver-pending31', 'Retrouver le 31e trajet'], ['driver-sent', 'Envoyer l’avis du conducteur'],
  ['parent-first-page', 'Ouvrir les avis du parent'], ['parent-continuation', 'Charger la suite des avis'],
  ['parent-more', 'Retrouver les 31 demandes'], ['parent-sent-top', 'Envoyer un avis sans perdre les autres'],
];
export const reviewPaginationRecheck = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
export const reviewPaginationCaptures = Object.fromEntries(images.map(([phase]) => ['review-page-' + phase, folder + 'captures/' + phase + '.jpg']));
export const reviewPaginationImages = images.map(([phase, title]) => ({file: 'review-page-' + phase,
  alt: title + ', capture de session du 29 octobre'}));
export const reviewPaginationTour = [
  {image: 'review-page-driver-pending31', title: 'Retrouver le 31e trajet', text: 'Le conducteur retrouve l’avis qui manquait après 30 trajets.'},
  {image: 'review-page-driver-sent', title: 'Envoyer son avis', text: 'L’avis est enregistré et disparaît des demandes du conducteur.'},
  {image: 'review-page-parent-continuation', title: 'Charger la suite', text: 'Le parent peut dépasser les 20 premiers avis et retrouver les 31 demandes.'},
  {image: 'review-page-parent-sent-top', title: 'Garder les autres demandes', text: 'Après l’envoi depuis la seconde page, les 30 autres avis restent chargés.'},
];
export const reviewPaginationProgress = {date: '2026-10-29', title: 'Les avis restent accessibles après 30 trajets',
  text: 'Conducteur et parent envoient l’avis du 31e trajet. La suite de la liste se charge sans perdre les autres demandes. Six captures ajoutées.',
  flow: 'ratings', source: folder + 'README.md'};
