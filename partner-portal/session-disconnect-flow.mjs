const source = 'docs/release/evidence/session-disconnect-native-2026-10-20/';

export function createSessionDisconnectFlow() {
  return { id: 'session-disconnect', title: 'Se déconnecter après une erreur', status: 'partial', checkedAt: '2026-10-20',
    summary: 'Le parent se déconnecte depuis l’erreur et reste déconnecté au relancement.',
    verified: 'Se déconnecter ouvre la connexion. Après fermeture complète et relancement, l’ancien compte ne revient pas.',
    remaining: 'Rejouer sur téléphone après une vraie coupure, puis pendant un trajet.',
    ui: { source: source + 'session-disconnect-results.json', groups: ['session-disconnect-process-restart'] },
    images: ['error', 'signed-out', 'reopened'].map((id, index) => ({ file: 'session-disconnect-' + id,
      alt: ['Erreur avant la déconnexion', 'Connexion après Se déconnecter', 'Connexion après fermeture et relancement'][index] +
        ', essai local du 20 octobre' })), source: source + 'README.md' };
}
