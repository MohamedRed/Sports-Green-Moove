const invitation = 'docs/release/evidence/invitation-phone-connection-2026-10-30/';
const capacity = 'docs/release/evidence/native-capacity-e64555e-2026-10-30/';
const recheck = 'docs/release/evidence/invitation-connection-recheck-2026-10-31/';

export const invitationRecheckProgress = {date:'2026-10-31', title:'Le lien enfant reste inaccessible sur téléphone',
  text:'Le nouvel essai bloque avant le formulaire. Aucun compte enfant n’est créé ; l’accès temporaire est fermé.',
  flow:'child-emergency', source:recheck + 'README.md', checksums:recheck + 'artifact-sha256.json'};

export const invitationConnectionProgress = {date: '2026-10-30', title: 'L’inscription enfant reste à terminer',
  text: 'La page ne s’ouvre pas sur le téléphone d’essai. Aucun compte n’a été créé.',
  flow: 'child-emergency', source: invitation + 'README.md', checksums: invitation + 'artifact-sha256.json'};
export const nativeCapacityProgress = {date: '2026-10-30', title: 'Le nouvel essai s’arrête avant les écrans',
  text: 'L’appareil de test ne démarre pas. Les résultats précédents restent disponibles.',
  flow: 'native-startup', source: capacity + 'README.md', checksums: capacity + 'artifact-sha256.json'};
export const preparationBlockers = [
  {id: 'child-invitation-browser', title: 'Relier le nouveau compte au parent',
    text: 'L’inscription et la connexion passent sur téléphone. La suite avec le parent reste à terminer.',
    next: 'Reprendre la validation du parent, puis vérifier le parcours depuis le partage du lien.', source: invitation + 'README.md',
    connectionHistory: recheck + 'README.md',
    previousLatestSource: 'docs/release/evidence/invitation-alias-phone-2026-11-02/README.md',
    latestSource: 'docs/release/evidence/approved-private-trials-2026-11-02/README.md'},
];
