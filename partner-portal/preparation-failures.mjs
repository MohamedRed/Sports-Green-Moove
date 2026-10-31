const invitation = 'docs/release/evidence/invitation-phone-connection-2026-10-30/';
const capacity = 'docs/release/evidence/native-capacity-e64555e-2026-10-30/';

export const invitationConnectionProgress = {date: '2026-10-30', title: 'L’inscription enfant reste à terminer',
  text: 'La page ne s’ouvre pas sur le téléphone d’essai. Aucun compte n’a été créé.',
  flow: 'child-emergency', source: invitation + 'README.md', checksums: invitation + 'artifact-sha256.json'};
export const nativeCapacityProgress = {date: '2026-10-30', title: 'Le nouvel essai s’arrête avant les écrans',
  text: 'L’appareil de test ne démarre pas. Les résultats précédents restent disponibles.',
  flow: 'native-startup', source: capacity + 'README.md', checksums: capacity + 'artifact-sha256.json'};
export const preparationBlockers = [
  {id: 'child-invitation-browser', title: 'L’inscription enfant sur téléphone',
    text: 'La page ne s’ouvre pas sur l’appareil d’essai.',
    next: 'Rétablir l’accès, puis vérifier la création du compte et l’accord du parent.', source: invitation + 'README.md'},
  {id: 'native-device-capacity', title: 'Reprendre le contrôle complet',
    text: 'Le dernier essai s’arrête avant l’ouverture de l’appareil.',
    next: 'Vérifier la nouvelle préparation, puis rejouer tous les écrans.', source: capacity + 'README.md'},
];
