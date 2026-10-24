const source = 'docs/release/evidence/remote-ride-stop-pass-2026-10-19/';
export function createRemoteRideStopFlow() {
  return { id: 'remote-ride-stop', title: 'Fin de trajet à distance', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le suivi s’arrête même avec l’app en arrière-plan, dans l’essai local.',
    verified: 'Une autre session termine le trajet. Le suivi s’arrête avant le retour dans l’app, qui n’affiche plus de course active.',
    remaining: 'À confirmer sur téléphone. La capture de fin masque la navigation du bas et n’est pas publiée. Pas encore en ligne.',
    ui: { source: source + 'remote-ride-stop-results.json', groups: ['remote-ride-stop'] },
    images: [{ file: 'remote-ride-stop-started', alt: 'Trajet conducteur avant la mise en arrière-plan, essai local du 19 octobre' }],
    source: source + 'README.md' };
}
