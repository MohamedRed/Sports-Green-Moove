const folder = 'docs/release/evidence/approved-private-trials-2026-11-02/';
export const approvedPrivateTrials = {source: folder + 'review.json', checkedAt: '2026-11-02', checksums: folder + 'artifact-sha256.json'};
export const approvedPrivateTrialProgress = [
  {date: '2026-11-02', title: 'Le compte enfant est créé sur téléphone',
    text: 'Inscription et connexion réussies avec des données de test. La suite avec le parent reste à terminer.',
    flow: 'child-emergency', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json'},
  {date: '2026-11-02', title: 'Le diagnostic réseau reste incomplet',
    text: 'Le réseau mobile apparaît après relancement. La remise à zéro du réglage échoue ; la coupure reste à rejouer.',
    flow: 'messages', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json'},
];
export const approvedPrivateTrialCaptures = Object.fromEntries(['mismatch', 'created', 'child-home']
  .map(id => ['child-signup-' + id, folder + 'phone/captures/' + id + '.png']));
