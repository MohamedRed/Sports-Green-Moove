const folder = 'docs/release/evidence/search-departure-phone-2026-10-31/';
export const searchDeparturePhone = {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-31'};
const images = [
  ['calendar-open', 'Choisir une date dans le calendrier'],
  ['clock-selected', 'Choisir 15 h 30'],
  ['clock-chosen', 'Date et heure confirmées'],
  ['search-reopened', 'Les choix restent au retour à la recherche'],
  ['dark', 'Les mêmes choix en mode sombre'],
];
export const searchDeparturePhoneImages = images.map(([name, label]) => ({file: 'search-departure-' + name,
  alt: label + ', capture de session du 31 octobre, compte de test'}));
export const searchDeparturePhoneCaptures = Object.fromEntries(images.map(([name]) =>
  ['search-departure-' + name, folder + 'captures/' + name + '.jpg']));
export const searchDeparturePhoneProgress = {date: '2026-10-31', title: 'Date et heure vérifiées sur téléphone',
  text: 'Choisir, annuler et retrouver la date et l’heure au retour fonctionne. Cinq captures ajoutées, avec un compte de test.',
  flow: 'search', source: folder + 'README.md'};
