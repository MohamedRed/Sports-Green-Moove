const folder = 'docs/release/evidence/child-booking-receipt-recheck-2026-10-30/';
export const childBookingReceiptRecheck = {source: folder + 'services.json', checkedAt: '2026-10-30', checksums: folder + 'artifact-sha256.json'};
export const childBookingReceiptProgress = {
  date: '2026-10-30', title: 'Deux places pour le même enfant, sans doublon',
  text: 'En local, la demande reste en attente après une confirmation perdue. Réessayer retrouve la même réservation. La fermeture sur téléphone reste à tester.',
  flow: 'booking', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json',
};
export const latestChatPreparationProgress = {
  date: '2026-10-30', title: 'La reprise du chat reste à rejouer',
  text: 'Le nouvel essai s’arrête avant la coupure. Le renvoi n’a pas été testé cette fois.',
  flow: 'messages', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json',
};
export const latestGeneratedCopyProgress = {
  date: '2026-10-30', title: 'La série principale passe à nouveau',
  text: 'En local, la série principale passe. Les essais séparés restent à stabiliser avant de tout valider.',
  flow: 'native-startup', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json',
};
