export function createSupportFlow(local, ui, shot) {
  return { id: 'support', title: 'Support', status: 'partial', checkedAt: '2026-10-22', latestEvidence: 'phone',
    summary: 'Le parent retrouve ses réponses et le statut de sa demande sur téléphone.',
    verified: 'Une demande, deux réponses et le statut Clôturée sont retrouvés après réouverture. L’autre compte ne voit rien. Les notes internes restent privées.',
    remaining: 'Tester les erreurs de connexion pendant l’envoi. Le parcours urgent a son essai séparé ; les e-mails restent à activer.',
    supportFollowupPhone: { source: 'docs/release/evidence/support-followup-phone-2026-10-22/results.json', checkedAt: '2026-10-22',
      checksums: 'docs/release/evidence/support-followup-phone-2026-10-22/artifact-sha256.json' },
    supportFollowup: { source: 'docs/release/evidence/support-followup-2026-10-22/results.json', checkedAt: '2026-10-22' },
    supportPhone: { source: 'docs/release/evidence/support-phone-2026-10-22/results.json', checkedAt: '2026-10-22',
      checksums: 'docs/release/evidence/support-phone-2026-10-22/artifact-sha256.json' },
    ui: { ...ui(['support-review-ui', 'admin-access-boundary-ui'], 'admin-ui-results.json'), checkedAt: '2026-10-15' },
    local: local(['support-request'], ['La demande est enregistrée avec le statut ouvert.', 'L’auteur de la demande est conservé.',
      'Une description vide est refusée.', 'Un parent ne peut pas traiter la demande comme administrateur.'],
    'docs/release/evidence/local-2026-10-15/results.json', '2026-10-15'),
    images: [
      ...['inbox-received', 'awaiting', 'answered', 'closed', 'reopened', 'driver-profile', 'foreign', 'restored-parent-profile', 'restored']
        .map((name, index) => ({ ...shot('support-followup-phone-' + name, [
          'Demande reçue', 'Demande sans réponse', 'Première réponse et statut En cours', 'Deux réponses et demande clôturée',
          'Historique après réouverture', 'Compte conducteur de test', 'Aucune demande du parent visible au conducteur',
          'Retour au compte parent', 'Historique retrouvé après reconnexion',
        ][index] + ', sur téléphone le 22 octobre'), ...(name === 'restored' ? { landscape: true } : {}) })),
      shot('support-phone-invalid', 'Description vide refusée, sur téléphone le 22 octobre'),
      shot('support-phone-filled', 'Demande de test prête à envoyer, sur téléphone le 22 octobre'),
      shot('support-phone-submitted', 'Confirmation de l’envoi unique, sur téléphone le 22 octobre'),
      shot('support-phone-reopened', 'Formulaire rouvert sans nouvel envoi, sur téléphone le 22 octobre'),
      shot('support-reviewed', 'Demande de test clôturée en local, le 15 octobre')],
    source: 'docs/release/evidence/support-followup-phone-2026-10-22/README.md' };
}
