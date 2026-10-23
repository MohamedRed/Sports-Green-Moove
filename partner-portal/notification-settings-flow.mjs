const folder = 'docs/release/evidence/notification-settings-phone-2026-10-23/';

export function createNotificationSettingsFlow() {
  return {
    id: 'notification-settings', title: 'Notifications', status: 'partial', checkedAt: '2026-10-23', latestEvidence: 'phone',
    summary: 'Lire une alerte sans toucher aux autres.',
    verified: 'La lecture reste enregistrée après un changement de compte. Chaque compte retrouve ses propres alertes. Quatre nouvelles captures.',
    remaining: 'Vérifier après fermeture complète. Ajouter l’envoi des alertes au téléphone et vérifier la version iPhone. Pas encore en ligne.',
    notificationReadPhone: {source: 'docs/release/evidence/notification-read-phone-2026-10-23/summary.json', checkedAt: '2026-10-23',
      checksums: 'docs/release/evidence/notification-read-phone-2026-10-23/artifact-sha256.json'},
    notificationConnectedServices: {source: 'docs/release/evidence/notification-connected-services-2026-10-23/summary.json', checkedAt: '2026-10-23',
      checksums: 'docs/release/evidence/notification-connected-services-2026-10-23/artifact-sha256.json'},
    notificationReadLocal: {source: 'docs/release/evidence/notification-read-local-2026-10-23/summary.json', checkedAt: '2026-10-23',
      checksums: 'docs/release/evidence/notification-read-local-2026-10-23/artifact-sha256.json'},
    notificationPermissionPhone: {source: folder + 'summary.json', checkedAt: '2026-10-23', checksums: folder + 'artifact-sha256.json'},
    notificationNativeRecheck: {source: 'docs/release/evidence/notification-native-c1d2a2ff-2026-10-23/summary.json',
      checkedAt: '2026-10-23', checksums: 'docs/release/evidence/notification-native-c1d2a2ff-2026-10-23/artifact-sha256.json'},
    images: [
      ...[['unread', 'Trois alertes non lues'], ['read', 'Une seule alerte marquée comme lue'],
        ['driver', 'Le conducteur retrouve uniquement ses alertes'], ['parent-return', 'Le parent retrouve la lecture enregistrée']]
        .map(([phase, alt]) => ({file: 'notification-read-phone-' + phase, alt: alt + ', essai sur téléphone le 23 octobre'})),
      ...[
      ['profile-blocked', 'Notifications bloquées dans le profil'], ['os-blocked', 'Autorisation du téléphone désactivée'],
      ['os-allowed', 'Autorisation du téléphone activée'], ['profile-allowed', 'Profil actualisé au retour des réglages'],
      ['options-blocked', 'Autorisation retirée : statut actualisé dans les paramètres'], ['profile-restored', 'Même statut retrouvé dans le profil'],
      ].map(([phase, alt]) => ({file: 'notification-phone-' + phase, alt: alt + ', essai sur téléphone le 23 octobre'})),
    ],
    source: folder + 'README.md',
  };
}
