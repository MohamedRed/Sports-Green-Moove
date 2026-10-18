const source = 'docs/release/evidence/local-team-enrollment-native-2026-10-18/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Les choix d’équipe et d’enfant passent en local. Les écrans sont ajoutés, mais restent à rejouer.',
    verified: 'Douze essais locaux vérifient les choix proposés. Un enfant n’est proposé que si le parent est actuellement vérifié.',
    remaining: 'Rejouer les écrans. Ajouter l’historique des demandes, la réponse du club et la conversation, puis tester sur téléphone.',
    local: { source: source + 'choices.json', groups: [
      'club-choices-use-only-current-canonical-active-memberships',
      'declared-children-appear-only-after-separate-current-manager-verification',
      'link-membership-and-verification-loss-remove-child-choices-before-any-write',
      'choice-cursors-are-bound-to-account-kind-club-and-server-team-identity'],
    checks: ['Seuls les clubs autorisés sont proposés.', 'Le parent doit être vérifié pour choisir son enfant.',
      'La perte des droits retire l’enfant des choix.', 'Les listes restent séparées entre comptes et équipes.'] },
    images: [], source: source + 'README.md' };
}
