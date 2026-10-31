const directory = 'docs/release/evidence/review-history-phone-2026-10-29/';
const captions = [['history-hidden', 'Retrouver ses avis à jour'], ['new-prompt', 'Noter un nouveau trajet'],
  ['driver-rated', 'Envoyer cinq étoiles'], ['parent-rated', 'Passer au compte parent'], ['driver-returned', 'Revenir sans retrouver l’avis envoyé'],
  ['parent-prompt', 'Les demandes du parent restent séparées'], ['signed-out', 'Compte déconnecté à la fin de l’essai']];
export const reviewHistoryPhone = {source: directory + 'summary.json', checkedAt: '2026-10-29', checksums: directory + 'artifact-sha256.json'};
export const reviewHistoryPhoneCaptures = Object.fromEntries(captions.map(([phase]) => ['review-history-' + phase, directory + 'captures/' + phase + '.jpg']));
export const reviewHistoryPhoneImages = captions.map(([phase, title]) => ({file: 'review-history-' + phase, alt: title + ', capture de session du 29 octobre'}));
export const reviewHistoryPhoneProgress = {date: '2026-10-29', title: 'Les avis restent à jour sur téléphone',
  text: 'Les anciens avis ne reviennent plus. Conducteur et parent peuvent chacun envoyer un nouvel avis. Sept captures ajoutées.',
  flow: 'ratings', source: directory + 'README.md'};
