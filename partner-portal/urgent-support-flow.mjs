export function createUrgentSupportFlow(shot) {
  return { id: 'support-urgent', title: 'Support urgent', status: 'partial', checkedAt: '2026-10-23', latestEvidence: 'local',
    summary: 'Une urgence apparaît directement dans l’espace support.',
    verified: 'En local, l’alerte apparaît sans recharger et disparaît après clôture. Le lien retrouve la demande. Le club ne voit rien.',
    remaining: 'Activer l’envoi d’e-mails et confirmer leur réception. Rejouer ensuite depuis l’app sur téléphone.',
    urgentSupport: { source: 'docs/release/evidence/support-urgent-2026-10-23/services.json', checkedAt: '2026-10-23' },
    images: [shot('support-urgent-active', 'Demande urgente dans l’espace support, essai local du 23 octobre'),
      shot('support-urgent-closed', 'Demande clôturée retrouvée par son lien, essai local du 23 octobre')],
    source: 'docs/release/evidence/support-urgent-2026-10-23/README.md' };
}
