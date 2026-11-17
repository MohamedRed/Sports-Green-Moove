const source = 'docs/release/evidence/emergency-dialer-pixel-2026-11-17/README.md';

export const emergencyDialerBlocker = {
  id: 'emergency-contact',
  title: 'Tester le contact d’urgence',
  checkedAt: '2026-11-17',
  text: 'Sur le téléphone de test, toucher l’icône Téléphone renvoie à l’accueil. Le passage depuis notre app reste à vérifier.',
  next: 'Rejouer le geste sur un téléphone qui ouvre le clavier d’appel, sans appeler. Vérifier aussi l’accès de l’enfant pendant son trajet.',
  source,
  previousSource: 'docs/release/evidence/emergency-dialer-samsung-2026-10-24/README.md',
};

export const emergencyDialerProgress = {
  date: emergencyDialerBlocker.checkedAt,
  flow: emergencyDialerBlocker.id,
  title: 'L’ouverture du clavier d’appel reste à vérifier',
  text: emergencyDialerBlocker.text,
  source,
};
