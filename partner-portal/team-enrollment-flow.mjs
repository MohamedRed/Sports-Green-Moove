const source = 'docs/release/evidence/local-team-enrollment-sdk-2026-10-18/';

export function createTeamEnrollmentFlow() {
  return { id: 'team-enrollment', title: 'Inscription à une équipe', status: 'partial', checkedAt: '2026-10-18',
    summary: 'Les demandes passent avec les données de test. Le nouveau parcours dans l’app reste à lancer.',
    verified: 'Six essais locaux passent. Les quatre essais d’écran précédents restent simulés.',
    remaining: 'Rejouer les demandes dans l’app. Ajouter l’historique, la réponse du responsable à l’écran et la conversation, puis tester sur téléphone.',
    ui: { source: 'docs/release/evidence/team-screen-export-2026-10-18/completed/component-results.json', groups: [
      'anUncertainReplyHasNoActionUntilTheUserReadsAgain', 'aReviewedRequestNeedsConfirmationAndNeverApprovesItself',
      'theParentSelectsAVerifiedChildWithoutChangingTheTeamOrAnotherSubject',
      'approvedWithdrawalIsConfirmedAndNarrowLargeTextRemainsWithinItsScreen'] },
    local: { source: source + 'fixtures.json', groups: [
      'fixture-parent-is-verified-by-two-actual-authenticated-transitions', 'reading-enrollment-views-does-not-create-an-enrollment',
      'owned-member-refusal-new-request-approval-and-withdrawal-have-five-events',
      'guardian-loss-denies-stale-child-withdrawal-without-an-enrollment-event',
      'exact-records-audit-actors-claims-and-unrelated-fixtures-stay-protected',
      'scoped-fixture-cleanup-restores-the-exact-prior-records-and-claims'],
    checks: ['Les demandes du parent et de l’enfant sont enregistrées.', 'Refus, nouvelle demande, accord et retrait passent en local.',
      'Un parent révoqué ne peut pas retirer une inscription approuvée.', 'Les données de test sont nettoyées sans changer les autres comptes.'] },
    images: [{ file: 'team-requested-simulated', alt: 'Demande en attente, essai local simulé du 18 octobre' },
      { file: 'team-approved-simulated-narrow', alt: 'Inscription déjà approuvée dans les réponses simulées, colonne étroite et texte agrandi' }],
    source: source + 'README.md' };
}
