const folder = 'docs/release/evidence/review-context-phone-replay-2026-10-29/';
export const reviewContextPhoneReplay = {source: folder + 'summary.json', checkedAt: '2026-10-29', checksums: folder + 'artifact-sha256.json'};
const selected = [
  ['first', '05-parent-first-page', 'Le trajet du 28 octobre reste distinct de celui du 29'],
  ['choice', '08-parent-later-trip-and-legacy', 'Le trajet du 29 octobre et la demande sans détails restent identifiables'],
  ['sent', '09-parent-rated', 'Seul l’avis choisi disparaît ; les 31 autres demandes restent chargées'],
  ['restored', '18-parent-restarted-legacy', 'Après fermeture complète, les 31 demandes et le cas sans détails sont retrouvés'],
  ['older', '16-parent-restarted-first', 'Le trajet du 28 octobre reste à noter après fermeture complète'],
  ['profile', '15-parent-reopened-profile', 'Le parent retrouve sa moyenne et ses 32 avis après fermeture complète'],
  ['driver', '03-driver-returned', 'L’avis envoyé ne réapparaît pas après reconnexion du conducteur'],
];
export const reviewReplayCaptures = Object.fromEntries(selected.map(([key, file]) => ['review-trip-replay-' + key, folder + 'captures/' + file + '.jpg']));
export const reviewReplayImages = selected.map(([key, , title]) => ({file: 'review-trip-replay-' + key,
  alt: title + ', comptes de test, capture de session du 29 octobre'}));
export const reviewReplayProgress = {date: '2026-10-29', title: 'Les avis restent au bon trajet après relancement',
  text: 'Deux comptes de test envoient chacun leur avis. Le parent retrouve sa liste et sa moyenne après fermeture complète. Sept captures ajoutées.',
  flow: 'ratings', source: folder + 'README.md'};
export const reviewContextGateProgress = {date: '2026-10-29', title: 'La série complète passe avec les détails des avis',
  text: 'La série complète passe en simulation. Les essais de suivi en conditions réelles restent à terminer.',
  flow: 'native-startup', source: folder + 'README.md'};
