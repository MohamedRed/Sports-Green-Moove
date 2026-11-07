const folder = 'docs/release/evidence/support-recovery-recheck-2026-10-30/';

export const supportRecoveryRecheckProgress = {
  date: '2026-10-30', title: 'La demande revient après fermeture complète',
  text: 'Après une coupure contrôlée, Réessayer retrouve la même demande sans doublon. Elle reste privée entre deux comptes de test. Une capture est ajoutée.',
  flow: 'support-submission', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json',
};
export const latestCopyRecheckProgress = {
  date: '2026-10-30', title: 'La copie des captures interrompt le nouvel essai',
  text: 'Les vérifications exécutées passent, mais la copie d’une capture arrête la série. La suite n’a pas été exécutée ; cet essai complet n’est pas validé.',
  flow: 'native-startup', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json',
};
