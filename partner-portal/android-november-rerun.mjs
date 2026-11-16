const evidenceFolder = 'docs/release/evidence/android-native-rerun-2026-11-16/';

export const androidNovemberRerun = {
  checkedAt: '2026-11-16',
  source: evidenceFolder + 'README.md',
  checksums: evidenceFolder + 'artifact-sha256.json',
};

export const androidNovemberRerunProgress = {
  date: androidNovemberRerun.checkedAt,
  flow: 'messages',
  coversFlows: ['native-startup'],
  title: 'La messagerie reprend après la coupure simulée',
  text: 'Après une coupure simulée, l’app conserve le brouillon et l’envoie une seule fois au retour du réseau. Le suivi et les alertes restent à vérifier sur téléphone.',
  source: androidNovemberRerun.source,
};
