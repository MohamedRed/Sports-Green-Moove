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
