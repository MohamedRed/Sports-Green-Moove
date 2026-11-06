const success = 'docs/release/evidence/native-matrix-115fee1-2026-11-06/';
const recheck = 'docs/release/evidence/native-recheck-cc1e6d7-2026-11-06/';
export const nativeMatrix115 = {source: success + 'summary.json', checkedAt: '2026-11-06',
  sha256: 'c10a97df32fe466b7eff5dcd307f163b49500cfcc6195256c631361b2cd136cc', checksums: success + 'artifact-sha256.json'};
export const nativeRecheckCc1 = {source: recheck + 'summary.json', checkedAt: '2026-11-06',
  sha256: '7ca2b9029ebcecad37a3047a2b16afdccc5569bc9e9881341fc2741c1f5be003', checksums: recheck + 'original-archives.json'};
export const nativeMatrix115Progress = {
  date: '2026-11-06', title: 'Un essai complet passe, le dernier reste interrompu',
  text: 'Les 37 parcours passent en simulation, y compris les messages après coupure réseau. Le dernier contrôle reste interrompu.',
  flow: 'publication', coversFlows: ['messages', 'native-startup'], source: success + 'README.md',
};
