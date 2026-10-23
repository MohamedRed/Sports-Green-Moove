const folder = 'docs/release/evidence/notification-settings-phone-2026-10-23/';

export function createNotificationSettingsFlow() {
  return {
    id: 'notification-settings', title: 'Réglage des notifications', status: 'partial', checkedAt: '2026-10-23', latestEvidence: 'phone',
    summary: 'Le statut suit l’autorisation donnée sur le téléphone.',
    verified: 'Depuis le profil et les paramètres : autoriser puis bloquer les notifications met le statut à jour au retour. Six captures ajoutées.',
    remaining: 'Vérifier la réception des vraies alertes et la version iPhone. Pas encore en ligne.',
    notificationPermissionPhone: {source: folder + 'summary.json', checkedAt: '2026-10-23', checksums: folder + 'artifact-sha256.json'},
    notificationNativeRecheck: {source: 'docs/release/evidence/notification-native-c1d2a2ff-2026-10-23/summary.json',
      checkedAt: '2026-10-23', checksums: 'docs/release/evidence/notification-native-c1d2a2ff-2026-10-23/artifact-sha256.json'},
    images: [
      ['profile-blocked', 'Notifications bloquées dans le profil'], ['os-blocked', 'Autorisation du téléphone désactivée'],
      ['os-allowed', 'Autorisation du téléphone activée'], ['profile-allowed', 'Profil actualisé au retour des réglages'],
      ['options-blocked', 'Autorisation retirée : statut actualisé dans les paramètres'], ['profile-restored', 'Même statut retrouvé dans le profil'],
    ].map(([phase, alt]) => ({file: 'notification-phone-' + phase, alt: alt + ', essai sur téléphone le 23 octobre'})),
    source: folder + 'README.md',
  };
}
