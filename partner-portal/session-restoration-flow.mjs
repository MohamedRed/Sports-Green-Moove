const source = 'docs/release/evidence/session-restoration-native-2026-10-20/';

export function createSessionRestorationFlow() {
  return { id: 'session-restoration', title: 'Reconnexion après une erreur', status: 'partial', checkedAt: '2026-10-20',
    summary: 'Le parent retrouve son compte après une erreur de test, même en tournant l’écran.',
    verified: 'L’erreur reste visible après rotation. Réessayer retrouve le même compte, qui reste connecté au retour en portrait.',
    remaining: 'Rejouer sur téléphone après une vraie coupure et tester Se déconnecter depuis l’erreur.',
    ui: { source: source + 'session-restoration-results.json', groups: ['session-restoration'] },
    images: ['error', 'rotated-error', 'recovered', 'restored'].map((id, index) => ({
      file: 'session-recovery-' + id, landscape: index === 1 || index === 2,
      alt: ['Erreur de reprise de session', 'Même erreur après passage en paysage',
        'Accueil retrouvé après Réessayer', 'Même accueil au retour en portrait'][index] + ', essai local du 20 octobre',
    })), source: source + 'README.md' };
}
