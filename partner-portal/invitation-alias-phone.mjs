const folder = 'docs/release/evidence/invitation-alias-phone-2026-11-02/';
export const invitationAliasPhone = {source: folder + 'review.json', checkedAt: '2026-11-02', checksums: folder + 'artifact-sha256.json'};
export const invitationAliasProgress = {date: '2026-11-02', title: 'Le formulaire enfant s’ouvre sur téléphone',
  text: 'Une confirmation différente est refusée. La création du compte reste bloquée.',
  flow: 'child-emergency', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json'};
export const invitationAliasCaptures = Object.fromEntries(['form-ready', 'mismatch-refused', 'signup-unconfirmed']
  .map(id => ['invitation-alias-' + id, folder + 'captures/' + id + '.png']));
