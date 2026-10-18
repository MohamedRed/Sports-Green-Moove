const source = 'docs/release/evidence/membership-cursor-2026-10-18/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Quatre essais d’écran passent avec des réponses simulées. Les captures restent à récupérer.',
    verified: 'Confirmation, choix de l’enfant, réponse incertaine et retrait passent. Les longues listes passent aussi huit essais locaux.',
    remaining: 'Récupérer les captures et rejouer les écrans avec les demandes réelles de test. Ajouter l’historique, la réponse du club et la conversation, puis tester sur téléphone.',
    local: { source: source + 'services-verified.json', groups: [
      'team-club-choices-resume-canonical-multibyte-memberships-with-cursors-over-two-kilobytes',
      'parent-guardian-club-choices-use-the-same-lossless-opaque-cursor-contract',
      'both-manager-club-directories-resume-long-canonical-membership-ids',
      'manager-membership-pages-preserve-composite-document-ids-without-losing-a-row',
      'parent-and-manager-guardian-pages-preserve-history-and-current-account-scopes',
      'manager-team-pages-use-the-shared-cursor-without-changing-any-enrollment',
      'foreign-account-list-and-club-cursors-remain-denied-after-increasing-size-support',
      'long-membership-decisions-still-require-current-manager-version-and-canonical-identity'],
    checks: ['Les choix restent accessibles après les vingt premiers.', 'Aucune ligne perdue ou ajoutée deux fois.',
      'Un autre compte ou club ne peut pas reprendre la liste.', 'Une adhésion est acceptée une seule fois.'] },
    images: [], source: 'docs/release/evidence/team-screen-export-2026-10-18/README.md' };
}
