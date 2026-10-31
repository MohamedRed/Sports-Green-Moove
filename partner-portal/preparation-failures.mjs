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
  {id: 'child-invitation-browser', title: 'L’inscription enfant sur téléphone',
    text: 'La page ne s’ouvre pas sur l’appareil d’essai.',
    next: 'Rétablir l’accès, puis vérifier la création du compte et l’accord du parent.', source: invitation + 'README.md', latestSource:recheck + 'README.md'},
];
