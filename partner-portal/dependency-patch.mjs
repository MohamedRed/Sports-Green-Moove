const directory = 'docs/release/evidence/dependency-patch-2026-10-28/';
export const dependencyPatchRecheck = {source: directory + 'summary.json', checkedAt: '2026-10-28',
  checksums: directory + 'artifact-sha256.json'};
export const dependencyPatchProgress = {date: '2026-10-28', title: 'Des défauts de sécurité corrigés',
  text: 'Les réservations et annulations passent les essais locaux après correction. D’autres alertes restent à traiter.',
  flow: 'native-startup', source: directory + 'README.md'};
export const networkPreparationProgress = {date: '2026-10-28', title: 'La coupure reste à tester',
  text: 'Le nouvel essai s’arrête avant de couper la connexion. Les captures précédentes restent disponibles.',
  flow: 'messages', source: directory + 'previous-ci/README.md'};
