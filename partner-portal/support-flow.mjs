export function createSupportFlow(local, ui, shot) {
  return { id: 'support', title: 'Support', status: 'partial', checkedAt: '2026-10-22', latestEvidence: 'phone',
    summary: 'La demande part depuis le téléphone. Le retour au demandeur reste à ajouter.',
    verified: 'Description vide refusée, puis un seul envoi enregistré. La réouverture ne crée pas de doublon. Prise en charge et clôture vérifiées séparément côté gestion, sans passer par ses écrans.',
    remaining: 'Ajouter le suivi et la réponse au demandeur, puis les tester sur téléphone. Rejouer les erreurs de connexion et la fermeture complète. Le mode urgent n’a pas été testé.',
    supportPhone: { source: 'docs/release/evidence/support-phone-2026-10-22/results.json', checkedAt: '2026-10-22',
      checksums: 'docs/release/evidence/support-phone-2026-10-22/artifact-sha256.json' },
    ui: { ...ui(['support-review-ui', 'admin-access-boundary-ui'], 'admin-ui-results.json'), checkedAt: '2026-10-15' },
    local: local(['support-request'], ['La demande est enregistrée avec le statut ouvert.', 'L’auteur de la demande est conservé.',
      'Une description vide est refusée.', 'Un parent ne peut pas traiter la demande comme administrateur.'],
    'docs/release/evidence/local-2026-10-15/results.json', '2026-10-15'),
    images: [shot('support-phone-invalid', 'Description vide refusée, sur téléphone le 22 octobre'),
      shot('support-phone-filled', 'Demande de test prête à envoyer, sur téléphone le 22 octobre'),
      shot('support-phone-submitted', 'Confirmation de l’envoi unique, sur téléphone le 22 octobre'),
      shot('support-phone-reopened', 'Formulaire rouvert sans nouvel envoi, sur téléphone le 22 octobre'),
      shot('support-reviewed', 'Demande de test clôturée en local, le 15 octobre')],
    source: 'docs/release/evidence/support-phone-2026-10-22/README.md' };
}
