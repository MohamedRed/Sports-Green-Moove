const source = 'docs/release/evidence/session-restoration-native-2026-10-20/';

export function createSessionRestorationFlow() {
  return { id: 'session-restoration', title: 'Reconnexion après une erreur', status: 'partial', checkedAt: '2026-10-21',
    summary: 'Le parent retrouve son compte après Réessayer et reste connecté en tournant l’écran, en local.',
    verified: 'Le nouvel essai passe : erreur visible, Réessayer, puis même compte au retour en portrait. Quatre nouvelles captures sont ajoutées.',
    remaining: 'Rejouer sur téléphone après une vraie coupure. Les interruptions précédentes restent à expliquer.',
    restorationRecheck: { source: 'docs/release/evidence/session-restoration-transport-2026-10-21/results.json' },
    restorationRecovery: { source: 'docs/release/evidence/session-restoration-native-2026-10-21/session-restoration-results.json' },
    ui: { source: source + 'session-restoration-results.json', checkedAt: '2026-10-20', groups: ['session-restoration'] },
    images: ['session-recheck-', 'session-recovery-'].flatMap((prefix, group) => ['error', 'rotated-error', 'recovered', 'restored'].map((id, index) => ({
      file: prefix + id, landscape: index === 1 || index === 2,
      alt: ['Erreur de reprise de session', 'Même erreur après passage en paysage',
        'Accueil retrouvé après Réessayer', 'Même accueil au retour en portrait'][index] + `, essai local du ${group ? 20 : 21} octobre`,
    }))), source: 'docs/release/evidence/session-restoration-native-2026-10-21/README.md' };
}
