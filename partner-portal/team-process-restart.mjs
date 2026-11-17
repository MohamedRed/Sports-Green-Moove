const directory = 'docs/release/evidence/phone-team-enrollment-restart-2026-10-28/';
const phases = [
  ['self-requested-again', 'Retrouver la nouvelle demande', 'Après le refus, le parent redemande son inscription. Elle revient en attente après fermeture complète.'],
  ['self-approved', 'Retrouver l’accord', 'Le club approuve la demande. L’accord reste visible après fermeture complète.'],
  ['self-withdrawn', 'Retrouver le retrait', 'Le parent retire son inscription. Elle ne se rouvre pas au redémarrage.'],
  ['child-requested', 'Demander pour son enfant', 'La demande de l’enfant revient en attente. Celle du parent reste retirée.'],
  ['child-approved', 'Retrouver l’accord pour l’enfant', 'L’enfant est approuvé. Le parent reste retiré : les deux inscriptions sont bien séparées.'],
];
export const teamRestartPhone = {
  checkedAt: '2026-10-28', source: directory + 'summary.json', checksums: directory + 'artifact-sha256.json',
};
export const teamRestartCaptures = Object.fromEntries(phases.map(([phase]) => [
  'team-restart-' + phase, directory + 'captures/' + phase + '.png',
]));
export const teamRestartImages = phases.map(([phase, title]) => ({
  file: 'team-restart-' + phase, alt: title + ', capture de session du 28 octobre',
}));
export const teamRestartTour = phases.map(([phase, title, text]) => ({
  image: 'team-restart-' + phase, title, text: text + ' Capture de session du 28 octobre.',
}));
export const teamRestartProgress = {
  date: '2026-10-28', title: 'Les inscriptions restent après fermeture de l’app',
  text: 'Demande, refus, accord et retrait : les états reviennent sur téléphone. L’inscription de l’enfant reste distincte. Cinq captures de session ajoutées.',
  flow: 'team-enrollment', source: directory + 'README.md',
};
