const folder = 'docs/release/evidence/trip-consent-phone-2026-10-25/';
export const tripConsentPhone = {source: folder + 'session-results.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-25'};
const step = (phase, title, text) => ({image: 'consent-phone-' + phase, title, text});
export const tripConsentPhoneTour = [
  step('draft-returned', 'Retrouver son brouillon', 'Le prix proposé revient après fermeture de l’éditeur. Rien n’a été envoyé.'),
  step('proposed', 'Demander l’accord', 'Le conducteur propose 4 € au lieu de 2,50 €. Deux parents doivent répondre.'),
  step('parent-one-accepted', 'Un premier accord', 'Un parent accepte. Le second doit encore répondre.'),
  step('both-parents-accepted', 'Deux accords distincts', 'Les deux parents ont accepté. Le nouveau prix n’est pas encore appliqué.'),
  step('declined', 'Refuser un changement', 'Sur un autre trajet, le refus conserve le trajet initial et les réservations.'),
  step('withdrawn', 'Retirer sa proposition', 'Le conducteur retire une autre proposition. Les réservations restent intactes.'),
];
export const tripConsentPhoneImages = tripConsentPhoneTour.map(step => ({file: step.image,
  alt: step.title + ', capture du téléphone du 25 octobre, données de test'}));
export const tripConsentPhoneCaptures = Object.fromEntries(['draft-returned', 'proposed', 'parent-one-accepted',
  'both-parents-accepted', 'declined', 'withdrawn'].map(phase => ['consent-phone-' + phase, folder + 'captures/' + phase + '-viewport.png']));
export const tripConsentPhoneProgress = {date: '2026-10-25', title: 'Les parents choisissent avant tout changement',
  text: 'Deux accords séparés, un refus et un retrait passent sur téléphone. Le trajet et les réservations restent intacts. Six captures ajoutées, avec des comptes de test.',
  flow: 'publication', source: folder + 'README.md'};
