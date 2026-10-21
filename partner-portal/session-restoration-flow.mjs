const source = 'docs/release/evidence/session-restoration-native-2026-10-20/';

export function createSessionRestorationFlow() {
  return { id: 'session-restoration', title: 'Reconnexion après une erreur', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Le nouvel essai s’arrête avant l’ouverture. Les captures précédentes restent disponibles.',
    verified: 'L’essai du 20 octobre retrouve le compte après une erreur et une rotation. Le nouvel essai n’atteint pas ces écrans.',
    remaining: 'Reprendre l’essai local, puis le rejouer sur téléphone après une vraie coupure.',
    restorationRecheck: { source: 'docs/release/evidence/session-restoration-transport-2026-10-21/results.json' },
    ui: { source: source + 'session-restoration-results.json', checkedAt: '2026-10-20', groups: ['session-restoration'] },
    images: ['error', 'rotated-error', 'recovered', 'restored'].map((id, index) => ({
      file: 'session-recovery-' + id, landscape: index === 1 || index === 2,
      alt: ['Erreur de reprise de session', 'Même erreur après passage en paysage',
        'Accueil retrouvé après Réessayer', 'Même accueil au retour en portrait'][index] + ', essai local du 20 octobre',
    })), source: 'docs/release/evidence/session-restoration-transport-2026-10-21/README.md' };
}
