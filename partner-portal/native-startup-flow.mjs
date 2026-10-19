const source = 'docs/release/evidence/native-startup-pass-2026-10-19/';
export function createNativeStartupFlow() {
  return { id: 'native-startup', title: 'Reprendre le suivi', status: 'partial', checkedAt: '2026-10-19',
    summary: 'La reprise passe en local. L’affichage reste à revoir.',
    verified: 'Une position déjà reçue permet la reprise. Une position invalide est refusée. Une nouvelle tentative efface l’ancienne erreur et la déconnexion arrête le suivi.',
    remaining: 'Le bas de l’écran manque sur deux captures. À revoir sur téléphone, avec les vraies positions, le verrouillage et les coupures. Pas encore en ligne.',
    ui: { source: source + 'native-startup-results.json', groups: ['native-tracking-startup'] },
    images: [
      ['started', 'Trajet ouvert avec une position déjà reçue'],
      ['signed-out', 'Retour à la connexion après arrêt du suivi'],
    ].map(([id, alt]) => ({ file: 'native-startup-' + id, alt: alt + ', essai local du 19 octobre' })),
    source: source + 'README.md' };
}
