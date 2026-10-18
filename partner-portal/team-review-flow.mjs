const source = 'docs/release/evidence/local-team-review-2026-10-18/';

export function createTeamReviewFlow() {
  return { id: 'team-review', title: 'Réponse du club', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Le responsable approuve, refuse et retire les inscriptions. Les essais locaux passent.',
    verified: '25 équipes et 25 demandes parcourues. Une réponse perdue ne crée pas de doublon ; les accès retirés effacent les choix.',
    remaining: 'Rejouer avec le parent dans l’app et sur téléphone. La mise en ligne reste à faire.',
    ui: { source: source + 'results.json', groups: ['team-manager-review-ui'] },
    images: [
      { file: 'team-review-requests', alt: 'Les demandes dans l’espace du club, essai local du 18 octobre', landscape: true },
      { file: 'team-review-confirmation', alt: 'Confirmation avant de répondre à une demande' },
      { file: 'team-review-recovered', alt: 'L’accord retrouvé après une réponse perdue' },
      { file: 'team-review-child-approved', alt: 'L’inscription de l’enfant est approuvée' },
      { file: 'team-review-child-revoked', alt: 'L’inscription est retirée après la perte des droits du parent' },
      { file: 'team-review-access-revoked', alt: 'Les choix sont effacés lorsque le responsable perd son accès' },
    ], source: source + 'README.md' };
}
