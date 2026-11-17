const evidenceFolder = 'docs/release/evidence/ios-fixture-recheck-4d9924b-2026-11-16/';

export const iosParentContactRecheck = {
  checkedAt: '2026-11-16',
  source: evidenceFolder + 'summary.json',
  checksums: evidenceFolder + 'source-sha256.json',
};

export const iosParentContactRecheckProgress = {
  date: iosParentContactRecheck.checkedAt,
  flow: 'child-emergency',
  title: 'Le contrôle du contact enfant doit être rejoué',
  text: 'Dix tests d’écran sur onze passent. Le contact est enregistré, puis le contrôle s’interrompt avant de rouvrir le choix du contact. La correction du geste de test reste à vérifier.',
  source: iosParentContactRecheck.source,
};

const passingEvidenceFolder = 'docs/release/evidence/ios-fixture-gate-941f85c-2026-11-17/';

export const iosParentContactFixturePass = {
  checkedAt: '2026-11-17',
  source: passingEvidenceFolder + 'summary.json',
  checksums: passingEvidenceFolder + 'build-input-sha256.json',
};

export const iosParentContactFixturePassProgress = {
  date: iosParentContactFixturePass.checkedAt,
  flow: 'child-emergency',
  title: 'Le contact enfant passe le contrôle en simulation',
  text: 'Les onze tests d’écran réussissent. Après l’enregistrement, le test rouvre le choix du contact et retrouve le contact enfant. Le suivi, l’appel et les notifications restent à vérifier sur téléphone.',
  source: iosParentContactFixturePass.source,
};
