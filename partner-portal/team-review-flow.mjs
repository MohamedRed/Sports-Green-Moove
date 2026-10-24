const source = 'docs/release/evidence/local-team-review-2026-10-18/';

export function createTeamReviewFlow() {
  return { id: 'team-review', title: 'Réponse du club', status: 'partial', checkedAt: '2026-10-19',
    summary: 'Le club répond dans son espace. Le parent retrouve sa réponse sur le téléphone.',
    verified: '25 équipes et 25 demandes parcourues. Une réponse perdue ne crée pas de doublon ; les accès retirés effacent les choix.',
    remaining: 'Tester après fermeture complète et sur d’autres appareils. La mise en ligne reste à faire.',
    ui: { source: source + 'results.json', checkedAt: '2026-10-18', groups: ['team-manager-review-ui'] },
    phone: { source: 'docs/release/evidence/phone-team-enrollment-2026-10-19/results.json' },
    images: [
      { file: 'team-phone-manager-approved', alt: 'Le club approuve la demande du parent, essai du 19 octobre', landscape: true },
      { file: 'team-phone-manager-child-approved', alt: 'L’enfant est approuvé et le parent reste retiré, essai du 19 octobre', landscape: true },
      { file: 'team-review-requests', alt: 'Les demandes dans l’espace du club, essai local du 18 octobre', landscape: true },
      { file: 'team-review-confirmation', alt: 'Confirmation avant de répondre à une demande, essai local du 18 octobre' },
      { file: 'team-review-recovered', alt: 'L’accord retrouvé après une réponse perdue, essai local du 18 octobre' },
      { file: 'team-review-child-approved', alt: 'L’inscription de l’enfant est approuvée, essai local du 18 octobre' },
      { file: 'team-review-child-revoked', alt: 'L’inscription est retirée après la perte des droits du parent, essai local du 18 octobre' },
      { file: 'team-review-access-revoked', alt: 'Les choix sont effacés lorsque le responsable perd son accès, essai local du 18 octobre' },
    ], source: source + 'README.md' };
}
