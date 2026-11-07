const folder = 'docs/release/evidence/booking-date-visual-2026-11-03/';
const cases = ['requests-scheduled-light-phone', 'requests-unknown-dark-wide', 'trips-unknown-light-phone',
  'trips-scheduled-dark-wide', 'payments-unknown-dark-phone', 'payments-scheduled-light-wide'];
const labels = {requests: 'Demandes de réservation', trips: 'Mes trajets', payments: 'Paiements'};

export const bookingDateVisualCaptures = Object.fromEntries(cases.map(name => ['booking-date-' + name, folder + 'captures/' + name + '.png']));
export const bookingDateVisualImages = cases.map(name => {
  const [screen, kind, theme, format] = name.split('-');
  return {file: 'booking-date-' + name, landscape: format === 'wide', checkedAt: '2026-11-03',
    alt: `${labels[screen]}, date ${kind === 'scheduled' ? 'fixée' : 'à confirmer'}, thème ${theme === 'light' ? 'clair' : 'sombre'}, format ${format === 'phone' ? 'étroit' : 'large'}, texte agrandi, essai simulé du 3 novembre`};
});
export const bookingDateVisualReview = {source: folder + 'review.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-11-03'};
export const bookingDateVisualProgress = {date: '2026-11-03', title: 'Les dates restent lisibles avec le texte agrandi',
  text: 'Demandes, trajets et paiements revus en clair et en sombre, en simulation. Six captures ajoutées.',
  flow: 'appearance', source: folder + 'README.md'};
