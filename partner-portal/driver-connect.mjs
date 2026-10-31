const base = 'docs/release/evidence/driver-connect-2026-10-24/';
export const driverConnectChecks = {source: base + 'summary.json', checksums: base + 'artifact-sha256.json', checkedAt: '2026-10-25'};
export const driverConnectImages = [
  {file: 'connect-safe-opening', alt: 'Ouverture en cours, bouton désactivé, essai local du 24 octobre'},
  {file: 'connect-safe-narrow', alt: 'Compte conducteur avec texte agrandi, essai local du 24 octobre'},
];
export const driverConnectTour = [
  {image: 'connect-safe-opening', title: 'Éviter les doubles appuis', text: 'Le bouton reste désactivé pendant l’ouverture, dans cet essai local.'},
  {image: 'connect-safe-narrow', title: 'Garder le texte lisible', text: 'Le bouton reste entier sur un écran étroit avec du texte agrandi. L’inscription réelle reste à tester.'},
];
export const driverConnectProgress = {date: '2026-10-25', title: 'Une seule ouverture du compte conducteur',
  text: 'Les doubles appuis sont bloqués en local. Le texte coupé d’un bouton est corrigé. Deux captures du 24 octobre ajoutées ; les contrôles sont revérifiés aujourd’hui.',
  flow: 'payments', source: base + 'README.md'};
