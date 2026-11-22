const folder = 'docs/release/evidence/trip-draft-phone-2026-10-26/';
export const tripDraftPhone = { source: folder + 'session-results.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-26' };
export const tripDraftPhoneTour = [
  { image: 'draft-phone-draft-before-stop', title: 'Laisser une modification inachevée',
    text: 'Le prix et les adresses restent en brouillon. Rien n’est envoyé.' },
  { image: 'draft-phone-draft-after-stop', title: 'Retrouver son brouillon',
    text: 'Après fermeture complète de l’app, les mêmes saisies reviennent sur le bon trajet.' },
  { image: 'draft-phone-other-trip-after-stop', title: 'Garder les trajets séparés',
    text: 'L’autre trajet garde son prix initial. Les réservations ne changent pas.' },
];
export const tripDraftPhoneImages = tripDraftPhoneTour.map(step => ({ file: step.image,
  alt: step.title + ', téléphone du 26 octobre, trajets fictifs' }));
export const tripDraftPhoneCaptures = Object.fromEntries(['draft-before-stop', 'draft-after-stop', 'other-trip-after-stop']
  .map(phase => ['draft-phone-' + phase, folder + 'captures/' + phase + '.png']));
export const tripDraftPhoneProgress = { date: '2026-10-26', title: 'Le brouillon survit à la fermeture de l’app',
  text: 'Prix et adresses retrouvés sur téléphone après fermeture complète. L’autre trajet et les réservations restent intacts. Trois captures ajoutées.',
  flow: 'publication', source: folder + 'README.md' };
