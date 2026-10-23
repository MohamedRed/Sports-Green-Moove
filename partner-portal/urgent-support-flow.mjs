export function createUrgentSupportFlow(shot) {
  return { id: 'support-urgent', title: 'Support urgent', status: 'partial', checkedAt: '2026-10-23', latestEvidence: 'phone',
    summary: 'Une urgence apparaît directement dans l’espace support.',
    verified: 'Sur téléphone avec les données isolées : envoi, alerte au support, réponse et clôture passent. La demande revient après reconnexion et reste invisible à l’autre compte.',
    remaining: 'Choisir une adresse d’expédition, activer les e-mails et confirmer leur réception. Rejouer ce canal depuis le téléphone.',
    urgentPhone: { source: 'docs/release/evidence/support-urgent-phone-2026-10-23/summary.json', checkedAt: '2026-10-23' },
    urgentSupport: { source: 'docs/release/evidence/support-urgent-2026-10-23/services.json', checkedAt: '2026-10-23' },
    images: [shot('support-urgent-phone-prepared', 'Demande urgente préparée, essai sur téléphone du 23 octobre'),
      shot('support-urgent-phone-answer', 'Réponse du support reçue, essai sur téléphone du 23 octobre'),
      shot('support-urgent-phone-closed', 'Demande clôturée avec sa réponse, essai sur téléphone du 23 octobre'),
      shot('support-urgent-phone-foreign', 'Aucune demande visible pour l’autre compte, essai sur téléphone du 23 octobre'),
      shot('support-urgent-phone-restored', 'Demande retrouvée après reconnexion, essai sur téléphone du 23 octobre'),
      shot('support-urgent-active', 'Demande urgente dans l’espace support, essai local du 23 octobre'),
      shot('support-urgent-closed', 'Demande clôturée retrouvée par son lien, essai local du 23 octobre')],
    source: 'docs/release/evidence/support-urgent-phone-2026-10-23/README.md' };
}
